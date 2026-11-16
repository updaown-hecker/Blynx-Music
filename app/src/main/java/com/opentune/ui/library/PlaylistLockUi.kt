package com.opentune.ui.library

import android.content.Context
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import androidx.annotation.RequiresApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.opentune.data.library.LibraryStore
import com.opentune.data.library.LocalPlaylist
import com.opentune.ui.components.AppSwitch
import com.opentune.ui.components.FloatingDialog
import com.opentune.ui.components.SheetButton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runInterruptible

@Composable
internal fun LockedPlaylistScreen(playlist: LocalPlaylist, onBack: () -> Unit) {
    val context = LocalContext.current
    var passwordOpen by remember(playlist.id) { mutableStateOf(false) }
    var signal by remember(playlist.id) { mutableStateOf<CancellationSignal?>(null) }
    if (passwordOpen) {
        PlaylistPasswordDialog(playlist, setup = false, onDismiss = { passwordOpen = false })
    }
    val owner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    DisposableEffect(playlist.id, owner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_STOP) signal?.cancel()
        }
        owner.lifecycle.addObserver(observer)
        onDispose {
            owner.lifecycle.removeObserver(observer)
            signal?.cancel()
        }
    }
    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.align(Alignment.Center).padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(Icons.Rounded.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Text("Playlist locked", style = MaterialTheme.typography.headlineSmall)
            Text("Unlock to see, play, or edit this playlist.", textAlign = TextAlign.Center)
            if (Build.VERSION.SDK_INT >= 30 && LibraryStore.playlistBiometricEnabled(playlist.id) && biometricsAvailable(context)) {
                TextButton(enabled = signal == null, onClick = {
                    val attempt = CancellationSignal()
                    signal = attempt
                    authenticate(context, attempt,
                        onSuccess = { LibraryStore.unlockPlaylistWithBiometrics(playlist.id) },
                        onFinished = { signal = null },
                    )
                }) { Text("Use fingerprint or biometrics") }
            }
            TextButton(enabled = signal == null, onClick = { passwordOpen = true }) { Text("Use playlist password") }
        }
        TopNavBar(playlist.name, true, onBack)
    }
}

@Composable
internal fun PlaylistPasswordDialog(playlist: LocalPlaylist, setup: Boolean, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var password by remember(playlist.id) { mutableStateOf("") }
    var confirmation by remember(playlist.id) { mutableStateOf("") }
    var enableBiometrics by remember(playlist.id) { mutableStateOf(false) }
    var working by remember(playlist.id) { mutableStateOf(false) }
    var error by remember(playlist.id) { mutableStateOf<String?>(null) }
    val allowBiometrics = setup && Build.VERSION.SDK_INT >= 30 && biometricsAvailable(context)
    val minLength = if (setup) 8 else 1
    FloatingDialog(
        onDismissRequest = { if (!working) onDismiss() },
        title = { Text(if (setup) "Password-protect playlist" else "Unlock playlist") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (setup) Text("Use at least 8 characters. Protection applies in Blynx Music. When you leave the app, this playlist locks and playback from it stops.")
                PlaylistPasswordField(password, { password = it; error = null }, "Playlist password", !working)
                if (setup) PlaylistPasswordField(confirmation, { confirmation = it; error = null }, "Confirm password", !working)
                if (allowBiometrics) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("Allow fingerprint or biometrics", Modifier.weight(1f))
                        AppSwitch(enableBiometrics, { enableBiometrics = it }, enabled = !working)
                    }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            SheetButton(
                if (setup) "Protect" else "Unlock",
                enabled = !working && password.length >= minLength && (!setup || confirmation.isNotEmpty()),
                loading = working,
                onClick = {
                    if (setup && password != confirmation) {
                        error = "Passwords don't match."
                    } else {
                        val secret = password.toCharArray()
                        val biometrics = enableBiometrics
                        password = ""
                        confirmation = ""
                        error = null
                        working = true
                        scope.launch {
                            try {
                                val success = runInterruptible(Dispatchers.IO) {
                                    if (setup) LibraryStore.protectPlaylist(playlist.id, secret, biometrics)
                                    else LibraryStore.unlockPlaylist(playlist.id, secret)
                                }
                                if (success) onDismiss() else {
                                    if (!setup) delay(750)
                                    error = if (setup) "Couldn't protect this playlist." else "Couldn't unlock with that password."
                                }
                            } catch (cancelled: CancellationException) {
                                throw cancelled
                            } catch (_: Exception) {
                                error = "Couldn't complete the request."
                            } finally {
                                secret.fill('\u0000')
                                working = false
                            }
                        }
                    }
                },
            )
        },
        dismissButton = { SheetButton("Cancel", onClick = onDismiss, enabled = !working) },
    )
}

@Composable
private fun PlaylistPasswordField(value: String, onChange: (String) -> Unit, label: String, enabled: Boolean) {
    OutlinedTextField(
        value = value,
        onValueChange = { if (it.length <= 128) onChange(it) },
        label = { Text(label) },
        enabled = enabled,
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        modifier = Modifier.fillMaxWidth(),
    )
}

@RequiresApi(30)
private fun biometricsAvailable(context: Context): Boolean =
    context.getSystemService(BiometricManager::class.java)
        ?.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS

@RequiresApi(30)
private fun authenticate(
    context: Context,
    signal: CancellationSignal,
    onSuccess: () -> Unit,
    onFinished: () -> Unit,
) {
    val prompt = BiometricPrompt.Builder(context)
        .setTitle("Unlock playlist")
        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        .setNegativeButton("Cancel", context.mainExecutor) { _, _ -> onFinished() }
        .build()
    prompt.authenticate(signal, context.mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            if (!signal.isCanceled) onSuccess()
            onFinished()
        }

        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            onFinished()
        }
    })
}

@Composable
internal fun PlaylistLockOptions(playlist: LocalPlaylist, onProtect: () -> Unit, onDismiss: () -> Unit) {
    FloatingDialog(
        onDismissRequest = onDismiss,
        title = { Text("Playlist lock") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Playlist only", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                    AppSwitch(playlist.playlistOnly, { LibraryStore.setPlaylistOnly(playlist.id, it) })
                }
                Text("Only play songs in this playlist. Pause automatic changes from YouTube Music and keep adding songs yourself.")
                if (playlist.passwordProtected) {
                    Text("Password protection also keeps playback inside this playlist.")
                    TextButton(onClick = { LibraryStore.removePlaylistProtection(playlist.id); onDismiss() }) {
                        Text("Remove password protection")
                    }
                } else {
                    TextButton(onClick = { onDismiss(); onProtect() }) { Text("Password-protect playlist") }
                }
            }
        },
        confirmButton = {
            if (playlist.passwordProtected) {
                SheetButton("Lock now", onClick = { onDismiss(); LibraryStore.relockPlaylists(playlist.id) })
            } else {
                SheetButton("Done", onClick = onDismiss)
            }
        },
    )
}
