package com.opentune.ui.account

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], application = android.app.Application::class)
class GoogleMusicSignInScreenTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    @Test fun offersManualSignInBeforeAndDuringTheAccountChooser() {
        compose.setContent { LoginScreen(onDone = {}) }
        val chooser = compose.onNodeWithText("Continue with Google")
        val manual = compose.onNodeWithText("Sign in with email and password")
        manual.assertExists()
        chooser.performClick()
        chooser.assertDoesNotExist()
        manual.assertExists()
        compose.onNodeWithContentDescription("Close sign-in").performClick()
        chooser.assertExists()
        manual.assertExists()
    }
}
