package com.opentune.ui.settings

import android.content.Context
import android.util.AtomicFile
import com.opentune.data.history.History
import com.opentune.data.library.LibraryStore
import com.opentune.data.settings.AppSettings
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

internal object AndroidCloudBackup {
    const val WEB = "https://music.blynx.vip/backup/"
    private const val API = "https://music.blynx.vip/api/android-backup"
    private const val MAX_BYTES = 6 * 1024 * 1024

    data class Status(
        val linked: Boolean = false,
        val pending: Boolean = false,
        val savedAt: Long? = null,
        val detail: String? = null,
    )

    private data class Device(val token: String, val revision: Long, val digest: String?)
    private data class Meta(val revision: Long, val savedAt: Long?)
    private data class Reply(val code: Int, val document: JsonObject?, val revision: Long?)
    private class SnapshotState {
        private val settings = AppSettings.state.value
        private val library = LibraryStore.backupIdentity()
        private val history = History.records.value

        fun isCurrent(): Boolean = settings === AppSettings.state.value &&
            library === LibraryStore.backupIdentity() && history === History.records.value
    }

    private var lastCheckedSnapshot: Pair<Device, SnapshotState>? = null
    private val mutex = Mutex()
    private val status = MutableStateFlow(Status())
    val state = status.asStateFlow()

    suspend fun connectionLink(context: Context): String? = operation {
        val token = ByteArray(32).also(SecureRandom()::nextBytes).hex()
        write(context, Device(token, -1, null))
        AndroidCloudBackupWorker.schedule(context)
        lastCheckedSnapshot = null
        status.value = Status(pending = true, detail = "Approve the connection in your browser.")
        WEB + "#" + sha(token)
    }

    fun hasConnection(context: Context): Boolean = file(context).baseFile.exists()

    suspend fun check(context: Context, allowUpload: Boolean = false): Boolean = operation {
        val device = read(context)
        if (device == null) {
            status.value = Status()
            return@operation true
        }
        val remote = meta(device) ?: return@operation true
        if (remote.revision == 0L || remote.revision == device.revision) {
            if (allowUpload) upload(context, device, remote, skipUnchanged = true)
            else status.value = Status(true, savedAt = remote.savedAt)
        } else {
            status.value = Status(true, savedAt = remote.savedAt, detail = "Restore this backup or choose to replace it with this device's data.")
        }
        true
    } ?: false

    suspend fun save(context: Context) = operation {
        val device = read(context) ?: return@operation
        val remote = meta(device) ?: return@operation
        upload(context, device, remote, skipUnchanged = false)
    }

    suspend fun restore(context: Context) = operation {
        val device = read(context) ?: return@operation
        val response = request(device, "GET")
        val doc = response.document ?: error("Could not download backup")
        val revision = response.revision ?: error("Backup revision missing")
        check(response.code == 200 && doc["version"]?.jsonPrimitive?.longOrNull == 1L)
        val previous = snapshot()
        try {
            apply(doc)
        } catch (failure: Exception) {
            apply(previous)
            throw failure
        }
        LibraryStore.flush()
        write(context, device.copy(revision = revision, digest = sha(snapshot().toString())))
        status.value = Status(true, savedAt = status.value.savedAt, detail = "Backup restored.")
    }

    suspend fun disconnect(context: Context) = operation {
        val device = read(context) ?: return@operation
        // A pending connection may not have been approved yet.
        val response = request(device, "DELETE")
        check(response.code == 200 || response.code == 401)
        file(context).delete()
        AndroidCloudBackupWorker.cancel(context)
        lastCheckedSnapshot = null
        status.value = Status()
    }

    private suspend fun <T> operation(block: () -> T): T? = mutex.withLock {
        try {
            withContext(Dispatchers.IO) { block() }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            status.value = status.value.copy(detail = "Cloud backup is temporarily unavailable. Your data is still on this device.")
            null
        }
    }

    private fun meta(device: Device): Meta? {
        val response = request(device, "GET", "/meta")
        if (response.code == 401) {
            status.value = Status(pending = device.revision < 0, detail = if (device.revision < 0)
                "Approve the connection in your browser, then check again." else "The connection expired. Connect this device again.")
            return null
        }
        check(response.code == 200)
        val doc = requireNotNull(response.document)
        return Meta(doc.getValue("revision").jsonPrimitive.long, doc["savedAt"]?.jsonPrimitive?.longOrNull)
    }

    private fun upload(context: Context, device: Device, remote: Meta, skipUnchanged: Boolean) {
        val previous = lastCheckedSnapshot
        if (skipUnchanged && remote.revision > 0 && previous?.first == device && previous.second.isCurrent()) {
            status.value = Status(true, savedAt = remote.savedAt)
            return
        }
        val state = SnapshotState()
        val document = snapshot()
        val digest = sha(document.toString())
        if (skipUnchanged && remote.revision > 0 && digest == device.digest) {
            lastCheckedSnapshot = device to state
            status.value = Status(true, savedAt = remote.savedAt)
            return
        }
        val payload = buildJsonObject {
            put("revision", remote.revision)
            put("document", document)
        }
        val response = request(device, "PUT", document = payload)
        when (response.code) {
            200 -> {
                val saved = requireNotNull(response.document)
                val current = device.copy(revision = saved.getValue("revision").jsonPrimitive.long, digest = digest)
                write(context, current)
                lastCheckedSnapshot = current to state
                status.value = Status(true, savedAt = saved["savedAt"]?.jsonPrimitive?.longOrNull)
            }
            409 -> status.value = Status(true, savedAt = remote.savedAt, detail = "Another device saved a newer backup. Restore it or confirm a replacement.")
            413 -> status.value = Status(true, savedAt = remote.savedAt, detail = "This backup exceeds the server's size limit.")
            else -> error("Could not save backup")
        }
    }

    private fun snapshot(): JsonObject = buildJsonObject {
        put("app", "Blynx Music")
        put("version", 1)
        put("settings", AppSettings.exportJson())
        put("library", LibraryStore.exportJson())
        put("history", History.exportJson())
    }

    private fun apply(doc: JsonObject) {
        LibraryStore.importJson(doc.getValue("library"))
        History.importJson(doc.getValue("history"))
        AppSettings.importJson(doc.getValue("settings"))
    }

    private fun request(device: Device, method: String, path: String = "", document: JsonObject? = null): Reply {
        val connection = URL(API + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 10_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("X-Blynx-Backup-Key", device.token)
            connection.setRequestProperty("Accept", "application/json")
            if (document != null) {
                val payload = document.toString().encodeToByteArray()
                if (payload.size > MAX_BYTES) return Reply(413, null, null)
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(payload.size)
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(payload) }
            }
            val code = connection.responseCode
            val body = if (code == 200) connection.inputStream.use { body ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = body.read(buffer)
                    if (count < 0) break
                    check(output.size() + count <= MAX_BYTES)
                    output.write(buffer, 0, count)
                }
                Json.parseToJsonElement(output.toString("UTF-8")).jsonObject
            } else null
            return Reply(code, body, connection.getHeaderField("X-Backup-Revision")?.toLongOrNull())
        } finally {
            connection.disconnect()
        }
    }

    private fun file(context: Context) = AtomicFile(File(context.noBackupFilesDir, "blynx-backup-device.json"))

    private fun read(context: Context): Device? {
        val file = file(context)
        if (!file.baseFile.exists()) return null
        val doc = Json.parseToJsonElement(file.readFully().decodeToString()).jsonObject
        return Device(
            requireNotNull(doc.getValue("token").jsonPrimitive.contentOrNull),
            doc.getValue("revision").jsonPrimitive.long,
            doc["digest"]?.jsonPrimitive?.contentOrNull,
        )
    }

    private fun write(context: Context, device: Device) {
        val file = file(context)
        val stream = file.startWrite()
        try {
            val json = buildJsonObject {
                put("token", device.token)
                put("revision", device.revision)
                device.digest?.let { put("digest", it) }
            }
            stream.write(json.toString().encodeToByteArray())
            file.finishWrite(stream)
        } catch (failure: Exception) {
            file.failWrite(stream)
            throw failure
        }
    }

    private fun sha(text: String) = MessageDigest.getInstance("SHA-256").digest(text.encodeToByteArray()).hex()

    private fun ByteArray.hex(): String = buildString(size * 2) {
        val digits = "0123456789abcdef"
        for (byte in this@hex) {
            val value = byte.toInt() and 255
            append(digits[value ushr 4])
            append(digits[value and 15])
        }
    }
}
