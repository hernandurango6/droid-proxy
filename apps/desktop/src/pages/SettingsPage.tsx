import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { droidproxy } from "@/lib/tauri";
import type { DesktopSettings } from "@/lib/types";

const DEFAULT_SETTINGS: DesktopSettings = {
  autoStart: false,
  minimizeToTray: true,
  allowLanAccess: false,
  quotaPollIntervalSec: 60,
  quotaAlertThresholds: { warn: 80, critical: 95 },
  quotaNotificationsEnabled: true
};

export function SettingsPage() {
  const [endpoint, setEndpoint] = useState("");
  const [settings, setSettings] = useState<DesktopSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const [status, desktopSettings] = await Promise.all([
      droidproxy.lab.status(),
      droidproxy.lab.desktopSettings()
    ]);
    setEndpoint(status.proxy.baseUrl || status.proxy.url || "");
    setSettings(desktopSettings);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await droidproxy.lab.saveDesktopSettings(settings);
      setSettings(saved);
      toast.success("Desktop settings saved");
      const [status] = await Promise.all([droidproxy.lab.status()]);
      setEndpoint(status.proxy.baseUrl || status.proxy.url || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell endpoint={endpoint} onRefresh={() => void refresh()}>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Desktop behavior</CardTitle>
            <CardDescription>
              Startup, tray, and network preferences for the DroidProxy shell.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-sm font-medium">Start with Windows</span>
                <p className="text-sm text-muted-foreground">
                  Registers a login item that launches DroidProxy minimized to the tray with
                  <code className="mx-1 rounded bg-muted px-1">--hidden</code>.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoStart}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, autoStart: event.target.checked }))
                }
              />
            </label>

            <label className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-sm font-medium">Minimize to tray on close</span>
                <p className="text-sm text-muted-foreground">
                  When enabled, closing the window hides DroidProxy to the tray and keeps services
                  running.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.minimizeToTray}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    minimizeToTray: event.target.checked
                  }))
                }
              />
            </label>

            <label className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-sm font-medium">Allow LAN access</span>
                <p className="text-sm text-muted-foreground">
                  Binds the proxy to all interfaces so other devices on your network can reach it.
                  Restarts services when toggled.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowLanAccess}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    allowLanAccess: event.target.checked
                  }))
                }
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quota alerts</CardTitle>
            <CardDescription>
              Background poller checks provider quotas while DroidProxy is running, including when
              minimized to the tray.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <label className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-sm font-medium">Enable notifications</span>
                <p className="text-sm text-muted-foreground">
                  Show Windows Action Center toasts when usage crosses warn or critical thresholds.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.quotaNotificationsEnabled}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    quotaNotificationsEnabled: event.target.checked
                  }))
                }
              />
            </label>

            <div className="grid gap-2">
              <label htmlFor="poll-interval" className="text-sm font-medium">
                Poll interval (seconds)
              </label>
              <Input
                id="poll-interval"
                type="number"
                min={30}
                max={300}
                value={settings.quotaPollIntervalSec}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    quotaPollIntervalSec: Number(event.target.value)
                  }))
                }
              />
              <p className="text-sm text-muted-foreground">Allowed range: 30–300 seconds.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="warn-threshold" className="text-sm font-medium">
                  Warning threshold (%)
                </label>
                <Input
                  id="warn-threshold"
                  type="number"
                  min={1}
                  max={99}
                  value={settings.quotaAlertThresholds.warn}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      quotaAlertThresholds: {
                        ...current.quotaAlertThresholds,
                        warn: Number(event.target.value)
                      }
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="critical-threshold" className="text-sm font-medium">
                  Critical threshold (%)
                </label>
                <Input
                  id="critical-threshold"
                  type="number"
                  min={2}
                  max={100}
                  value={settings.quotaAlertThresholds.critical}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      quotaAlertThresholds: {
                        ...current.quotaAlertThresholds,
                        critical: Number(event.target.value)
                      }
                    }))
                  }
                />
              </div>
            </div>

            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}