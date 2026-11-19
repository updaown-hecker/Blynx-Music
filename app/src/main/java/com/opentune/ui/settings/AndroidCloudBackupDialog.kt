package com.opentune.ui.settings

import android.text.format.DateFormat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.opentune.ui.components.FloatingDialog
import com.opentune.ui.components.SheetButton
import java.util.Date
import kotlinx.coroutines.launch

@Composable
internal fun AndroidCloudBackupDialog(onDismiss: () -> Unit) {
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val scope = rememberCoroutineScope()
    val state by AndroidCloudBackup.state.collectAsState()
    var busy by remember { mutableStateOf(false) }
    var confirm by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { AndroidCloudBackup.check(context.applicationContext) }

    fun perform(action: suspend () -> Unit) {
        scope.launch {
            busy = true
            try { action() } finally { busy = false }
        }
    }

    FloatingDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Cloud backup") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Back up settings, playlists, likes and listening history to your account on music.blynx.vip. Connect once in your browser. Automatic backups run in the background when you leave the app.")
                state.savedAt?.let {
                    val date = Date(it)
                    Text("Last backup: " + DateFormat.getDateFormat(context).format(date) + " " + DateFormat.getTimeFormat(context).format(date))
                }
                state.detail?.let { Text(it) }
                if (!state.linked) {
                    TextButton(enabled = !busy, onClick = {
                        perform { AndroidCloudBackup.connectionLink(context.applicationContext)?.let(uri::openUri) }
                    }) { Text(if (state.pending) "Open a new connection link" else "Connect in browser") }
                    if (state.pending) {
                        TextButton(enabled = !busy, onClick = { perform { AndroidCloudBackup.check(context.applicationContext) } }) {
                            Text("Check connection")
                        }
                    }
                } else {
                    TextButton(enabled = !busy, onClick = { confirm = "Back up now" }) { Text("Back up now") }
                    if (state.savedAt != null) {
                        TextButton(enabled = !busy, onClick = { confirm = "Restore backup" }) { Text("Restore backup") }
                    }
                    TextButton(enabled = !busy, onClick = { confirm = "Disconnect" }) { Text("Disconnect this device") }
                }
                TextButton(enabled = !busy, onClick = { uri.openUri(AndroidCloudBackup.WEB) }) { Text("Manage backup on the web") }
                Text("Password-protected playlists, account sign-ins and downloaded audio stay on this device.")
            }
        },
        confirmButton = { SheetButton("Done", enabled = !busy, onClick = onDismiss) },
    )

    confirm?.let { action ->
        FloatingDialog(
            onDismissRequest = { confirm = null },
            title = { Text(action) },
            text = { Text(when (action) {
                "Back up now" -> "Save this device's data in place of the existing cloud backup."
                "Restore backup" -> "Replace this device's saved settings, library and history with the cloud backup."
                else -> "Stop automatic backups from this device. The existing backup will remain in your account."
            }) },
            confirmButton = {
                SheetButton(action, onClick = {
                    confirm = null
                    perform {
                        when (action) {
                            "Back up now" -> AndroidCloudBackup.save(context.applicationContext)
                            "Restore backup" -> AndroidCloudBackup.restore(context.applicationContext)
                            else -> AndroidCloudBackup.disconnect(context.applicationContext)
                        }
                    }
                })
            },
            dismissButton = { SheetButton("Cancel", onClick = { confirm = null }) },
        )
    }
}
