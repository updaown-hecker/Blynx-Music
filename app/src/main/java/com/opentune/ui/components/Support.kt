package com.opentune.ui.components

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.FilterChip
import com.opentune.ui.theme.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import com.opentune.ui.theme.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.edit
import androidx.core.net.toUri
import java.util.Locale
import java.util.concurrent.TimeUnit

/** Ways to back the project: a star on GitHub, or money over UPI. */
object Support {
    val REPO: String get() = com.opentune.data.config.RemoteConfig.current.github
    const val UPI_ID = "whoosthis@axl"
    private const val PAYEE = "OpenTune"
    private const val NOTE = "Support OpenTune"
    /** Suggested amounts, in rupees. */
    val AMOUNTS = listOf(49, 99, 199, 499)

    /**
     * A UPI payment link for [rupees], which any UPI app opens with the
     * payee and amount filled in. Built by hand: UPI apps want the "@" in
     * the address as it is, not percent-encoded.
     */
    fun upiLink(rupees: Double): String =
        "upi://pay?pa=$UPI_ID&pn=$PAYEE&am=${String.format(Locale.ROOT, "%.2f", rupees)}&cu=INR&tn=${NOTE.replace(" ", "%20")}"

    /** Asks which UPI app to pay with, the amount already in. */
    fun pay(context: Context, rupees: Double) {
        val view = Intent(Intent.ACTION_VIEW, upiLink(rupees).toUri())
        try {
            context.startActivity(Intent.createChooser(view, "Send with").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: android.content.ActivityNotFoundException) {
            com.opentune.data.Pills.error(com.opentune.i18n.Tr.f("No UPI app on this phone. You can send it to {0} from another one.", UPI_ID), context)
        }
    }

    private val MIN_GAP_MS = TimeUnit.DAYS.toMillis(30)
    private fun prefs(context: Context) = context.getSharedPreferences("support", Context.MODE_PRIVATE)

    fun usedToday(context: Context, now: Long = System.currentTimeMillis()) {
        val p = prefs(context)
        val day = TimeUnit.MILLISECONDS.toDays(now)
        if (p.getLong("lastDay", -1) == day) return
        p.edit { putLong("lastDay", day); putInt("days", p.getInt("days", 0) + 1) }
    }

    fun shouldAskForStar(context: Context, now: Long = System.currentTimeMillis()): Boolean {
        if (!com.opentune.data.config.RemoteConfig.current.communityPrompts) return false
        val p = prefs(context)
        return shouldAsk(p.getBoolean("done", false), p.getInt("days", 0), p.getLong("askedAt", 0), now)
    }

    internal fun shouldAsk(done: Boolean, days: Int, askedAt: Long, now: Long): Boolean =
        !done && days >= 5 && now - askedAt >= MIN_GAP_MS

    /** Record an impression so closing the app cannot trigger another prompt. */
    fun answered(context: Context, never: Boolean, now: Long = System.currentTimeMillis()) = prefs(context).edit {
        putLong("askedAt", now)
        if (never) putBoolean("done", true)
    }

}

/** A thank-you to the developer: a few suggested sums, or your own, sent from the phone's UPI app. */
@Composable
fun SupportDialog(onDismiss: () -> Unit) {
    val context = LocalContext.current
    var text by remember { mutableStateOf("99") }
    val rupees = text.toDoubleOrNull()?.takeIf { it >= 1 && it <= 100_000 }
    FloatingDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Rounded.Favorite, null) },
        title = { Text("Project support") },
        text = {
            Column {
                Text("This optional contribution goes to the original open-source maintainers.")
                Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Support.AMOUNTS.forEach { a ->
                        FilterChip(selected = text == a.toString(), onClick = { text = a.toString() }, label = { Text("₹$a") })
                    }
                }
                OutlinedTextField(
                    value = text,
                    onValueChange = { v -> text = v.filter { it.isDigit() || it == '.' }.take(8) },
                    singleLine = true,
                    prefix = { Text("₹") },
                    label = { Text("Your thank-you") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                Text(
                    com.opentune.i18n.Tr.f("Goes to {0}", Support.UPI_ID),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            SheetButton(
                rupees?.let { com.opentune.i18n.Tr.f("Send ₹{0}", if (it % 1.0 == 0.0) it.toLong().toString() else String.format(Locale.ROOT, "%.2f", it)) } ?: com.opentune.i18n.Tr.t("Send"),
                enabled = rupees != null,
                onClick = { rupees?.let { Support.pay(context, it) }; onDismiss() },
            )
        },
        dismissButton = { SheetButton("Maybe later", onClick = onDismiss, closes = true) },
    )
}

/** A dismissible monthly invitation to star the Blynx Music project. */
@Composable
fun StarInviteCard(onDismiss: () -> Unit) {
    val context = LocalContext.current
    androidx.compose.runtime.LaunchedEffect(Unit) { Support.answered(context, never = false) }
    FloatingDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Rounded.Star, null) },
        title = { Text("Project support") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Star Blynx Music on GitHub.")
                androidx.compose.material3.FilledTonalButton(
                    onClick = {
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, "https://github.com/updaown-hecker/Blynx-Music".toUri())) }
                        onDismiss()
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Rounded.Star, null, Modifier.size(18.dp))
                    Text("Star on GitHub", Modifier.padding(start = 8.dp))
                }
                androidx.compose.material3.TextButton(onClick = { Support.answered(context, never = true); onDismiss() }) {
                    Text("Don't show again")
                }
            }
        },
        confirmButton = { SheetButton("Maybe later", onClick = onDismiss, closes = true) },
    )
}
