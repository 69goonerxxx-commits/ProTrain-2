package com.program.protrain;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

// Home-screen widget with four looks (a clean card, a day-colour card, a week strip and a streak ring).
// The app (shim-late.js) sends the plan, this week's sessions, the streak and the chosen look whenever it opens or a
// workout is saved. Everything the widget shows is worked out here from that data, so it moves on to the new day by
// itself after midnight even if the app is not running.
public class ProTrainWidget extends AppWidgetProvider {
  static final String KEY = "widget_json";
  static final int REFRESH_REQ = 9;
  static final int ORANGE = 0xFFF5A623;
  static final int GREEN = 0xFF5DCAA5;
  static final int INK = 0xFF1A1A1F;
  static final int SOFT_INK = 0xFF3A3A42;
  static final int INK_FAINT = 0x401A1A1F;
  static final int DOT_DONE = 0xFFF5A623;
  static final int DOT_REST = 0xFF1F1F27;
  static final int DOT_FUTURE = 0xFF3A3A44;
  static final int DOT_MISSED = 0xFF6B3A3A;
  static final String[] LETTERS = {"M", "T", "W", "T", "F", "S", "S"};

  // everything the four looks can show
  static class Info {
    String style = "a";
    String title = "ProTrain";
    String status = "Open the app to sync";
    String dayName = "";
    boolean found = false;
    boolean rest = false;
    boolean done = false;
    int exercises = -1;
    int color = ORANGE;
    int streak = -1;
    int weekDone = 0;
    int weekPlanned = 0;
    int[] dots = new int[7];
  }

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

  static int vid(Context c, String name) {
    return idOf(c, name, "id");
  }

  static String key(Calendar cal) {
    return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.getTime());
  }

  static Info read(Context c) {
    Info f = new Info();
    try {
      String raw = RestTimerCore.prefs(c).getString(KEY, "");
      if (raw.isEmpty()) return f;
      JSONObject o = new JSONObject(raw);
      String st = o.optString("style", "a");
      if ("b".equals(st) || "c".equals(st) || "d".equals(st)) f.style = st;
      Calendar now = Calendar.getInstance();
      String today = key(now);
      Calendar yest = Calendar.getInstance();
      yest.add(Calendar.DAY_OF_YEAR, -1);
      String yesterday = key(yest);
      f.dayName = new SimpleDateFormat("EEEE", Locale.getDefault()).format(now.getTime());

      // key -> {rest, done}, from this week's record and the days ahead
      HashMap<String, int[]> map = new HashMap<String, int[]>();
      JSONArray week = o.optJSONArray("week");
      if (week != null) {
        for (int i = 0; i < week.length(); i++) {
          JSONObject d = week.getJSONObject(i);
          map.put(d.optString("k"), new int[] {d.optInt("r", 0), d.optInt("d", 0)});
        }
      }
      JSONArray days = o.optJSONArray("days");
      if (days != null) {
        for (int i = 0; i < days.length(); i++) {
          JSONObject d = days.getJSONObject(i);
          String k = d.optString("k");
          map.put(k, new int[] {d.optInt("r", 0), d.optInt("d", 0)});
          if (today.equals(k)) {
            f.found = true;
            f.title = d.optString("t", "Workout");
            f.rest = d.optInt("r", 0) == 1;
            f.done = d.optInt("d", 0) == 1;
            f.exercises = d.optInt("n", -1);
            String col = d.optString("c", "");
            if (!col.isEmpty()) {
              try {
                f.color = Color.parseColor(col);
              } catch (Throwable t) {
                f.color = ORANGE;
              }
            }
            f.status = f.rest ? "Rest day" : (f.done ? "Done \u2713" : "Not done yet");
          }
        }
      }

      // a streak last updated before yesterday could be out of date, so it is left out
      String asOf = o.optString("asOf", "");
      if (today.equals(asOf) || yesterday.equals(asOf)) f.streak = o.optInt("streak", 0);

      // this week, Monday to Sunday
      Calendar mon = Calendar.getInstance();
      mon.add(Calendar.DAY_OF_YEAR, -((mon.get(Calendar.DAY_OF_WEEK) + 5) % 7));
      for (int i = 0; i < 7; i++) {
        Calendar d = (Calendar) mon.clone();
        d.add(Calendar.DAY_OF_YEAR, i);
        String k = key(d);
        int[] e = map.get(k);
        if (e == null) {
          f.dots[i] = 0;
          continue;
        }
        if (e[0] == 1) {
          f.dots[i] = 1;
        } else {
          f.weekPlanned++;
          if (e[1] == 1) {
            f.dots[i] = 2;
            f.weekDone++;
          } else if (k.equals(today)) {
            f.dots[i] = 3;
          } else if (k.compareTo(today) < 0) {
            f.dots[i] = 4;
          } else {
            f.dots[i] = 5;
          }
        }
      }
    } catch (Throwable t) {
      // fall back to whatever was read so far
    }
    return f;
  }

  static RemoteViews build(Context c) {
    Info f = read(c);
    RemoteViews v;
    String rootName;
    if ("b".equals(f.style)) {
      v = new RemoteViews(c.getPackageName(), idOf(c, "protrain_widget_b", "layout"));
      drawB(c, v, f);
      rootName = "pt_b_root";
    } else if ("c".equals(f.style)) {
      v = new RemoteViews(c.getPackageName(), idOf(c, "protrain_widget_c", "layout"));
      drawC(c, v, f);
      rootName = "pt_c_root";
    } else if ("d".equals(f.style)) {
      v = new RemoteViews(c.getPackageName(), idOf(c, "protrain_widget_d", "layout"));
      drawD(c, v, f);
      rootName = "pt_d_root";
    } else {
      v = new RemoteViews(c.getPackageName(), idOf(c, "protrain_widget", "layout"));
      drawA(c, v, f);
      rootName = "pt_w_root";
    }
    PendingIntent open = RestTimerCore.openApp(c);
    if (open != null) v.setOnClickPendingIntent(vid(c, rootName), open);
    return v;
  }

  static String weekText(Info f) {
    return f.weekPlanned > 0 ? f.weekDone + " of " + f.weekPlanned + " this week" : "";
  }

  static void setText(Context c, RemoteViews v, String name, String text) {
    v.setTextViewText(vid(c, name), text);
  }

  static void show(Context c, RemoteViews v, String name, boolean on) {
    v.setViewVisibility(vid(c, name), on ? View.VISIBLE : View.GONE);
  }

  // A: clean card
  static void drawA(Context c, RemoteViews v, Info f) {
    setText(c, v, "pt_w_title", f.title);
    setText(c, v, "pt_w_status", f.status);
    String s = f.streak > 0 ? f.streak + " day streak" : "";
    setText(c, v, "pt_w_streak", s);
    show(c, v, "pt_w_streak", !s.isEmpty());
  }

  // B: the card takes the colour of the day
  static void drawB(Context c, RemoteViews v, Info f) {
    v.setInt(vid(c, "pt_b_bg"), "setColorFilter", f.color);
    String top = f.dayName + " \u00b7 " + (f.rest ? "rest day" : (f.done ? "done" : (f.exercises > 0 ? f.exercises + " exercises" : "today")));
    setText(c, v, "pt_b_top", top);
    String s = f.streak > 0 ? "\uD83D\uDD25 " + f.streak : "";
    setText(c, v, "pt_b_streak", s);
    show(c, v, "pt_b_streak", !s.isEmpty());
    setText(c, v, "pt_b_title", f.found ? f.title : "ProTrain");
    show(c, v, "pt_b_check", f.found && f.done);
    int planned = Math.min(Math.max(f.weekPlanned, 0), 7);
    for (int i = 0; i < 7; i++) {
      int id = vid(c, "pt_b_s" + i);
      v.setViewVisibility(id, i < planned ? View.VISIBLE : View.GONE);
      v.setInt(id, "setColorFilter", i < f.weekDone ? INK : INK_FAINT);
    }
    String w = weekText(f);
    setText(c, v, "pt_b_week", f.found ? w : "Open the app to sync");
  }

  // C: today's workout and the seven days of the week
  static void drawC(Context c, RemoteViews v, Info f) {
    setText(c, v, "pt_c_title", f.title);
    String s = f.streak > 0 ? f.streak + " day streak" : "";
    setText(c, v, "pt_c_streak", s);
    show(c, v, "pt_c_streak", !s.isEmpty());
    String w = weekText(f);
    setText(c, v, "pt_c_status", w.isEmpty() ? f.status : f.status + " \u00b7 " + w);
    for (int i = 0; i < 7; i++) {
      int id = vid(c, "pt_c_d" + i);
      int st = f.dots[i];
      if (st == 3) {
        v.setImageViewResource(id, idOf(c, "protrain_dot_ring", "drawable"));
        v.setInt(id, "setColorFilter", ORANGE);
      } else {
        v.setImageViewResource(id, idOf(c, "protrain_dot", "drawable"));
        int col = st == 2 ? DOT_DONE : st == 1 ? DOT_REST : st == 4 ? DOT_MISSED : DOT_FUTURE;
        v.setInt(id, "setColorFilter", col);
      }
    }
  }

  // D: the streak inside a ring that fills as the week's sessions get done
  static void drawD(Context c, RemoteViews v, Info f) {
    boolean ok = f.found && !f.rest && f.done;
    int max = Math.max(f.weekPlanned, 1);
    int prog = Math.min(f.weekDone, max);
    v.setProgressBar(vid(c, "pt_d_ring_o"), max, prog, false);
    v.setProgressBar(vid(c, "pt_d_ring_g"), max, prog, false);
    show(c, v, "pt_d_ring_o", !ok);
    show(c, v, "pt_d_ring_g", ok);
    setText(c, v, "pt_d_num", f.streak >= 0 ? String.valueOf(f.streak) : "-");
    setText(c, v, "pt_d_label", f.found && !f.rest && f.exercises > 0 ? "TODAY \u00b7 " + f.exercises + " EXERCISES" : "TODAY");
    setText(c, v, "pt_d_title", f.title);
    String w = weekText(f);
    setText(c, v, "pt_d_week", f.found ? (f.rest ? "Rest day" : w) : f.status);
    show(c, v, "pt_d_start", f.found && !f.rest && !f.done);
    show(c, v, "pt_d_done", f.found && !f.rest && f.done);
  }
}
