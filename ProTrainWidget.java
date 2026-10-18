package com.program.protrain;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

// Home-screen widget: today's workout, whether it is done, and the streak.
// The app (shim-late.js) sends the next few days of the plan whenever it opens or a workout is saved;
// the widget picks today's entry from that list, so it stays correct after midnight without the app running.
public class ProTrainWidget extends AppWidgetProvider {
  static final String KEY = "widget_json";
  static final int REFRESH_REQ = 9;

  @Override
  public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
    for (int id : ids) m.updateAppWidget(id, build(c));
    scheduleMidnight(c);
  }

  static void save(Context c, String json) {
    RestTimerCore.prefs(c).edit().putString(KEY, json).apply();
    refreshAll(c);
  }

  static void refreshAll(Context c) {
    try {
      AppWidgetManager m = AppWidgetManager.getInstance(c);
      int[] ids = m.getAppWidgetIds(new ComponentName(c, ProTrainWidget.class));
      if (ids == null || ids.length == 0) return;
      for (int id : ids) m.updateAppWidget(id, build(c));
    } catch (Throwable t) {
      // never let a widget problem break the app
    }
  }

  // one gentle refresh just after midnight so the widget switches to the new day
  static void scheduleMidnight(Context c) {
    try {
      AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
      if (am == null) return;
      Calendar cal = Calendar.getInstance();
      cal.add(Calendar.DAY_OF_YEAR, 1);
      cal.set(Calendar.HOUR_OF_DAY, 0);
      cal.set(Calendar.MINUTE, 1);
      cal.set(Calendar.SECOND, 0);
      cal.set(Calendar.MILLISECOND, 0);
      AppWidgetManager m = AppWidgetManager.getInstance(c);
      int[] ids = m.getAppWidgetIds(new ComponentName(c, ProTrainWidget.class));
      Intent i = new Intent(c, ProTrainWidget.class);
      i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
      PendingIntent pi = PendingIntent.getBroadcast(c, REFRESH_REQ, i, RestTimerCore.pendingFlags());
      am.set(AlarmManager.RTC, cal.getTimeInMillis(), pi);
    } catch (Throwable t) {
      // the 30 minute system refresh still covers it
    }
  }

  static int idOf(Context c, String name, String type) {
    return c.getResources().getIdentifier(name, type, c.getPackageName());
  }

  static String key(Calendar cal) {
    return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.getTime());
  }

  static RemoteViews build(Context c) {
    RemoteViews v = new RemoteViews(c.getPackageName(), idOf(c, "protrain_widget", "layout"));
    String title = "ProTrain";
    String status = "Open the app to sync";
    String streak = "";
    try {
      String raw = RestTimerCore.prefs(c).getString(KEY, "");
      if (!raw.isEmpty()) {
        JSONObject o = new JSONObject(raw);
        Calendar now = Calendar.getInstance();
        String today = key(now);
        Calendar yest = Calendar.getInstance();
        yest.add(Calendar.DAY_OF_YEAR, -1);
        String yesterday = key(yest);
        JSONArray days = o.optJSONArray("days");
        if (days != null) {
          for (int i = 0; i < days.length(); i++) {
            JSONObject d = days.getJSONObject(i);
            if (today.equals(d.optString("k"))) {
              title = d.optString("t", "Workout");
              boolean rest = d.optInt("r", 0) == 1;
              boolean done = d.optInt("d", 0) == 1;
              status = rest ? "Rest day" : (done ? "Done \u2713" : "Not done yet");
              break;
            }
          }
        }
        int s = o.optInt("streak", 0);
        String asOf = o.optString("asOf", "");
        // a streak number that was last updated before yesterday could be out of date, so it is hidden
        if (s > 0 && (today.equals(asOf) || yesterday.equals(asOf))) streak = s + " day streak";
      }
    } catch (Throwable t) {
      // fall back to the defaults above
    }
    v.setTextViewText(idOf(c, "pt_w_title", "id"), title);
    v.setTextViewText(idOf(c, "pt_w_status", "id"), status);
    v.setTextViewText(idOf(c, "pt_w_streak", "id"), streak);
    v.setViewVisibility(idOf(c, "pt_w_streak", "id"), streak.isEmpty() ? View.GONE : View.VISIBLE);
    PendingIntent open = RestTimerCore.openApp(c);
    if (open != null) v.setOnClickPendingIntent(idOf(c, "pt_w_root", "id"), open);
    return v;
  }
}
