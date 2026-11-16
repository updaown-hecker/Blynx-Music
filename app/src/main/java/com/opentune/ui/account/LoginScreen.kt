package com.opentune.ui.account

import android.accounts.AccountManager
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.net.Uri
import android.graphics.Bitmap
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextButton
import com.opentune.ui.theme.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.opentune.R
import com.opentune.data.account.AccountStore
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayCircle

private const val MUSIC = "https://music.youtube.com"
private const val DESTROY_AFTER_MS = 1_500L
private const val MUSIC_SIGN_IN_RETURN =
    "https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26next%3Dhttps%253A%252F%252Fmusic.youtube.com%252F"
private const val MANUAL_SIGN_IN_URL =
    "https://accounts.google.com/ServiceLogin?ltmpl=music&service=youtube&passive=true&continue=$MUSIC_SIGN_IN_RETURN"
private const val GOOGLE_ACCOUNT_TYPE = "com.google"

@Composable
fun LoginScreen(onDone: () -> Unit) {
    var browserOpen by rememberSaveable { mutableStateOf(false) }
    var accountHint by rememberSaveable { mutableStateOf<String?>(null) }
    var pickerUnavailable by rememberSaveable { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            val email = data?.getStringExtra(AccountManager.KEY_ACCOUNT_NAME)
            if (!email.isNullOrBlank() && data?.getStringExtra(AccountManager.KEY_ACCOUNT_TYPE) == GOOGLE_ACCOUNT_TYPE) {
                val saved = AccountStore.accounts.value.firstOrNull { it.email.equals(email, ignoreCase = true) }
                if (saved != null) {
                    AccountStore.switchTo(saved.id)
                    onDone()
                } else {
                    accountHint = email
                    browserOpen = true
                }
            } else {
                pickerUnavailable = true
            }
        }
    }
    if (!browserOpen) {
        BackHandler(onBack = onDone)
        SignInPage(
            service = "YouTube Music",
            brand = YouTubeMusicRed,
            icon = Icons.Rounded.PlayCircle,
            gives = "Your playlists, liked songs, history and recommendations",
            loading = false,
            onBack = onDone,
        ) { modifier ->
            Box(modifier, contentAlignment = Alignment.Center) {
                Column(
                    Modifier.widthIn(max = 440.dp).fillMaxWidth()
                        .verticalScroll(rememberScrollState()).padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("Connect YouTube Music", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Choose a Google account from this device. Google may ask you to verify it when connecting for the first time.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    val googleButton = if (MaterialTheme.colorScheme.background.luminance() < 0.5f) {
                        R.drawable.google_sign_in_dark
                    } else R.drawable.google_sign_in_light
                    // Google's unmodified 3x artwork with a 48 dp touch target.
                    Box(
                        Modifier.align(Alignment.CenterHorizontally).size(180.dp, 48.dp)
                            .clickable(role = Role.Button) {
                                pickerUnavailable = false
                                try {
                                    picker.launch(AccountManager.newChooseAccountIntent(
                                        null, null, arrayOf(GOOGLE_ACCOUNT_TYPE), null, null, null, null,
                                    ))
                                } catch (_: ActivityNotFoundException) {
                                    pickerUnavailable = true
                                }
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Image(
                            painterResource(googleButton), contentDescription = "Sign in with Google",
                            modifier = Modifier.size(180.dp, 40.dp),
                        )
                    }
                    if (pickerUnavailable) {
                        Text("The Google account picker is unavailable. Use email and password below.")
                    }
                    TextButton(
                        onClick = { accountHint = null; browserOpen = true },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Sign in with email and password") }
                }
            }
        }
    } else {
        key(accountHint) {
            GoogleMusicSignInBrowser(
                accountHint = accountHint,
                onSignedIn = onDone,
                onBack = { browserOpen = false; accountHint = null },
                onManualSignIn = { accountHint = null },
            )
        }
    }
}

/** The provider's sign-in flow returns a YouTube Music session to [AccountStore]. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun GoogleMusicSignInBrowser(
    accountHint: String?,
    onSignedIn: () -> Unit,
    onBack: () -> Unit,
    onManualSignIn: () -> Unit,
) {
    var loading by remember { mutableStateOf(true) }
    var finished by remember { mutableStateOf(false) }
    // Set once the screen has gone: a page that finishes loading after that is ignored.
    val gone = remember { java.util.concurrent.atomic.AtomicBoolean(false) }
    // Some devices (most TVs, and phones with Android System WebView turned off or mid-update)
    // can't make a WebView: creating one throws. That's said here instead of closing the app.
    var unavailable by remember { mutableStateOf(false) }
    DisposableEffect(Unit) { onDispose { gone.set(true) } }
    val main = remember { android.os.Handler(android.os.Looper.getMainLooper()) }
    // The page is left once, however many ways ask at the same moment (the back key, the
    // back arrow, a sign-in finishing): a second leave popped the page under this one too.
    val left = remember { java.util.concurrent.atomic.AtomicBoolean(false) }
    fun leave(action: () -> Unit) {
        if (!gone.get() && left.compareAndSet(false, true)) action()
    }
    val web = remember { java.util.concurrent.atomic.AtomicReference<WebView?>(null) }
    // Back steps back through Google's pages first, and leaves only from the first one.
    BackHandler {
        val page = web.get()
        if (page != null && !left.get() && page.canGoBack()) page.goBack() else leave(onBack)
    }

    SignInPage(
        service = "YouTube Music",
        brand = YouTubeMusicRed,
        icon = Icons.Rounded.PlayCircle,
        gives = "Your playlists, liked songs, history and recommendations",
        loading = loading,
        onBack = { leave(onBack) },
        alternateSignIn = if (accountHint != null) {
            { leave(onManualSignIn) }
        } else null,
        unavailable = if (unavailable) {
            "Sign-in needs Android System WebView, which isn't working on this device. Update or turn it on in the " +
                "Play Store, or sign in on your phone and use Link a device to sign this one in."
        } else null,
    ) { webModifier ->
        AndroidView(
            modifier = webModifier,
            factory = { context ->
                val view = runCatching {
                    CookieManager.getInstance().setAcceptCookie(true)
                    WebView(context)
                }.onFailure {
                    android.util.Log.w("LoginScreen", "No WebView for sign-in", it)
                    unavailable = true
                    loading = false
                }.getOrNull() ?: return@AndroidView android.view.View(context)
                view.apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                    // Some phones are sent back to YouTube's own site (m.youtube.com) rather than
                    // YouTube Music once signed in, and the screen sat on YouTube's home page. The
                    // session is the same on any YouTube page: taken from there, and YouTube Music
                    // opened so its own cookies are set. Checked again for a few seconds, as the
                    // cookies can arrive just after the page says it has finished.
                    var sentToMusic = false
                    fun check(view: WebView, url: String?) {
                        if (gone.get() || left.get() || finished) return
                        val page = url?.let(Uri::parse) ?: return
                        if (page.scheme != "https") return
                        val host = page.host?.lowercase() ?: return
                        if (host != "youtube.com" && !host.endsWith(".youtube.com")) return
                        // The hand-over page from Google, which sets the new session: an older one can still be there.
                        if (page.path?.startsWith("/signin") == true) return
                        val cookie = CookieManager.getInstance().getCookie(MUSIC) ?: return
                        if (!AccountStore.hasSession(cookie)) return
                        if (host != "music.youtube.com") {
                            if (!sentToMusic) { sentToMusic = true; view.loadUrl("$MUSIC/") }
                            return
                        }
                        finished = true
                        CookieManager.getInstance().flush()
                        // Closed once this callback has returned: leaving from inside it destroyed
                        // the WebView while it was still running the callback, and on some WebView
                        // versions that crashed the app outright, signed in or not.
                        main.post {
                            leave {
                                AccountStore.signIn(cookie)
                                onSignedIn()
                            }
                        }
                    }
                    webViewClient = object : WebViewClient() {
                        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                            if (!gone.get()) loading = true
                        }

                        override fun onPageFinished(view: WebView, url: String?) {
                            if (gone.get()) return
                            loading = false
                            check(view, url)
                            for (wait in listOf(1_000L, 2_500L, 5_000L)) main.postDelayed({ if (!gone.get()) check(view, view.url) }, wait)
                        }

                        // YouTube's pages change address without loading a new page.
                        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                            if (!gone.get()) check(view, url)
                        }
                    }
                    web.set(this)
                    // A fresh session prevents a different cached Google account from taking over.
                    // The selected address is only a hint to Google's own page.
                    val signInUrl = accountHint?.let {
                        Uri.parse(MANUAL_SIGN_IN_URL).buildUpon().appendQueryParameter("Email", it).build().toString()
                    } ?: MANUAL_SIGN_IN_URL
                    com.opentune.ui.spotify.SpotifyConnection.keepingSpotify { done ->
                        CookieManager.getInstance().removeAllCookies { removed ->
                            done.onReceiveValue(removed)
                            main.post {
                                if (!gone.get() && !left.get()) loadUrl(signInUrl)
                            }
                        }
                    }
                }
            },
            // Taken down only once it's off the screen: destroying it while still attached,
            // as leaving the page did, crashed some WebView versions on the way back.
            onRelease = { view ->
                web.set(null)
                (view as? WebView)?.run {
                    stopLoading()
                    onPause()
                    webViewClient = WebViewClient()
                    (parent as? android.view.ViewGroup)?.removeView(this)
                    // Well after the page has gone: the frosted bars draw a copy of what's under
                    // them, and a frame still holding the page's last picture must never draw a
                    // WebView already destroyed. Never inside one of its own callbacks either.
                    main.postDelayed({ runCatching { destroy() } }, DESTROY_AFTER_MS)
                }
            },
        )
    }
}
