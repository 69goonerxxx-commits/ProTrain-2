package com.program.protrain;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationManagerCompat;

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

  // for the in-app "Test timer notification" button: reports what Android itself says about our notification
  @PluginMethod
  public void debug(PluginCall call) {
    Context c = getContext();
    JSObject r = new JSObject();
    r.put("sdk", Build.VERSION.SDK_INT);
    r.put("enabled", NotificationManagerCompat.from(c).areNotificationsEnabled());
    NotificationManager m = RestTimerCore.nm(c);
    int importance = -2;
    boolean live = false;
    int posted = 0;
    if (m != null) {
      if (Build.VERSION.SDK_INT >= 26) {
        NotificationChannel ch = m.getNotificationChannel(RestTimerCore.CH_LIVE);
        importance = ch == null ? -1 : ch.getImportance();
      }
      if (Build.VERSION.SDK_INT >= 23) {
        StatusBarNotification[] list = m.getActiveNotifications();
        posted = list.length;
        for (StatusBarNotification n : list) {
          if (n.getId() == RestTimerCore.ID_LIVE) live = true;
        }
      }
    }
    r.put("channelImportance", importance);
    r.put("liveShown", live);
    r.put("postedCount", posted);
    call.resolve(r);
  }
}
