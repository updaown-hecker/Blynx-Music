package com.opentune.ui.account

import android.accounts.AccountManager
import android.app.Activity
import android.content.Intent
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], application = android.app.Application::class)
class GoogleMusicSignInScreenTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    @Test fun deviceAccountPickerLeavesManualSignInAvailable() {
        compose.setContent { LoginScreen(onDone = {}) }
        val google = compose.onNodeWithContentDescription("Sign in with Google")
        val manual = compose.onNodeWithText("Sign in with email and password")
        manual.assertExists()
        google.performClick()
        compose.runOnIdle {
            val activity = shadowOf(compose.activity)
            val launch = requireNotNull(activity.nextStartedActivityForResult)
            compose.activity.activityResultRegistry.dispatchResult(
                launch.requestCode, Activity.RESULT_OK,
                Intent().putExtra(AccountManager.KEY_ACCOUNT_NAME, "listener@example.com")
                    .putExtra(AccountManager.KEY_ACCOUNT_TYPE, "com.google"),
            )
        }
        google.assertDoesNotExist()
        manual.assertExists()
        compose.onNodeWithContentDescription("Close sign-in").performClick()
        google.assertExists()
        manual.assertExists()
    }
}
