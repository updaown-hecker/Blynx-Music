package com.opentune.desktop

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.loadSvgPainter
import androidx.compose.ui.unit.Density

/** The Blynx lynx mark in white, or its plum launcher icon. */
object Logo {
    const val MARK = "logo/mark.svg"
    const val APP = "logo/app.svg"

    fun load(path: String, density: Density): Painter =
        Thread.currentThread().contextClassLoader.getResourceAsStream(path)!!.use { loadSvgPainter(it, density) }
}

@Composable
fun rememberLogo(path: String): Painter {
    val density = LocalDensity.current
    return remember(path, density) { Logo.load(path, density) }
}
