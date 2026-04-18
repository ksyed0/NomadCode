package com.nomadcode.mobileide

import android.view.KeyEvent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class KeyboardShortcutsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KeyboardShortcuts"

    @ReactMethod
    fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        val isCmd = event.isMetaPressed || event.isCtrlPressed
        if (!isCmd) return false

        val modifiers = WritableNativeArray()
        modifiers.pushString("cmd")
        if (event.isShiftPressed) modifiers.pushString("shift")
        if (event.isAltPressed) modifiers.pushString("alt")

        val key = when (keyCode) {
            KeyEvent.KEYCODE_S -> "s"
            KeyEvent.KEYCODE_N -> "n"
            KeyEvent.KEYCODE_P -> "p"
            KeyEvent.KEYCODE_SLASH -> "/"
            KeyEvent.KEYCODE_GRAVE -> "`"
            else -> return false
        }

        val params = WritableNativeMap()
        params.putString("key", key)
        params.putArray("modifiers", modifiers)

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onShortcut", params)
        return true
    }
}
