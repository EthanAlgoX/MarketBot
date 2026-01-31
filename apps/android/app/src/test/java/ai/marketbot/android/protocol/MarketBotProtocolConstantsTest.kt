package ai.marketbot.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class MarketBotProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", MarketBotCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", MarketBotCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", MarketBotCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", MarketBotCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", MarketBotCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", MarketBotCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", MarketBotCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", MarketBotCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", MarketBotCapability.Canvas.rawValue)
    assertEquals("camera", MarketBotCapability.Camera.rawValue)
    assertEquals("screen", MarketBotCapability.Screen.rawValue)
    assertEquals("voiceWake", MarketBotCapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", MarketBotScreenCommand.Record.rawValue)
  }
}
