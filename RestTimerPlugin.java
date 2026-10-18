package com.program.protrain;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.SharedPreferences;

// The bridge the web app uses: start the live countdown notification, read what happened to it, clear it.
@CapacitorPlugin(name = "RestTimer")
public class RestTimerPlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    JSObject d = call.getData();
    long end = d.optLong("endMs", 0L);
    if (end <= System.currentTimeMillis()) {
      call.resolve();
      return;
    }
    RestTimerCore.start(
        getContext(),
        end,
        d.optLong("totalMs", 0L),
        d.optString("title", "Rest"),
        d.optString("prefix", ""),
        d.optString("nextLabel", "Next set at"),
        d.optString("doneTitle", "Rest complete"),
        d.optString("doneText", "Time for your next set."));
    call.resolve();
  }

  @PluginMethod
  public void getState(PluginCall call) {
    SharedPreferences p = RestTimerCore.prefs(getContext());
    JSObject r = new JSObject();
    r.put("active", p.getBoolean("active", false));
    r.put("skipped", p.getBoolean("skipped", false));
    r.put("finished", p.getBoolean("finished", false));
    r.put("endMs", p.getLong("end", 0L));
    r.put("totalMs", p.getLong("total", 0L));
    call.resolve(r);
  }

  @PluginMethod
  public void clear(PluginCall call) {
    RestTimerCore.clear(getContext());
    call.resolve();
  }
}
