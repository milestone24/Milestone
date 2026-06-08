import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMobilePlatform } from "@/hooks/use-mobile-platform";
import MobileSettings from "@/components/mobile/MobileSettings";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme } from "@/context/ThemeContext";
import {
  Bell,
  Moon,
  Sun,
  Monitor,
  Download,
  LifeBuoy,
  FileJson,
  FileSpreadsheet,
  DatabaseBackup,
  Key,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailIngestInboxesSettings } from "@/components/email-ingest";

export default function Settings() {
  const { toast } = useToast();
  const isMobile = useMobilePlatform();
  const { theme, setTheme } = useTheme();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [appNotifications, setAppNotifications] = useState(true);
  const [autoUpdates, setAutoUpdates] = useState(true);
  const [currency, setCurrency] = useState("GBP");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");

  // API Integration states
  const [xaiApiKey, setXaiApiKey] = useState("");
  const [hasXaiApiKey, setHasXaiApiKey] = useState(false);
  const [isTestingXaiKey, setIsTestingXaiKey] = useState(false);
  const [xaiKeyValid, setXaiKeyValid] = useState<boolean | null>(null);

  // Check if we have an API key stored
  useEffect(() => {
    // This would normally make an API call to the backend to check
    // if the user has an xAI API key stored
    const checkForExistingKey = async () => {
      try {
        const response = await fetch("/api/settings/xai-key-status");
        if (response.ok) {
          const data = await response.json();
          setHasXaiApiKey(data.hasKey);
          if (data.hasKey) {
            // Don't show the actual key, just the fact that it exists
            setXaiApiKey("●●●●●●●●●●●●●●●●●●●●");
          }
        }
      } catch (error) {
        console.error("Error checking for xAI key:", error);
      }
    };

    checkForExistingKey();
  }, []);

  const handleSaveSettings = () => {
    // In a real app, we would save these settings to an API
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const handleDataExport = (format: string) => {
    // In a real app, we would generate and download the file
    toast({
      title: "Export started",
      description: `Your data is being exported in ${format} format. This might take a moment.`,
    });

    // Simulate download delay
    setTimeout(() => {
      toast({
        title: "Export complete",
        description: "Your data has been exported successfully.",
      });
    }, 1500);
  };

  // Handler for saving xAI API key
  const handleSaveXaiKey = async () => {
    if (!xaiApiKey.trim()) {
      toast({
        title: "Missing API Key",
        description: "Please enter a valid xAI API key",
        variant: "destructive",
      });
      return;
    }

    setIsTestingXaiKey(true);
    setXaiKeyValid(null);

    try {
      // First test if the key is valid
      const response = await fetch("/api/settings/verify-xai-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: xaiApiKey }),
      });

      if (response.ok) {
        const data = await response.json();
        setXaiKeyValid(data.valid);

        if (data.valid) {
          // Save the valid key
          const saveResponse = await fetch("/api/settings/xai-key", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ apiKey: xaiApiKey }),
          });

          if (saveResponse.ok) {
            setHasXaiApiKey(true);
            // Mask the key for display
            setXaiApiKey("●●●●●●●●●●●●●●●●●●●●");

            toast({
              title: "API Key Saved",
              description: "Your xAI API key has been saved successfully.",
              variant: "default",
            });
          } else {
            toast({
              title: "Failed to Save",
              description:
                "There was an error saving your API key. Please try again.",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Invalid API Key",
            description:
              "The API key you provided is not valid. Please check and try again.",
            variant: "destructive",
          });
        }
      } else {
        setXaiKeyValid(false);
        toast({
          title: "Verification Failed",
          description: "Unable to verify your API key. Please try again later.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving xAI API key:", error);
      setXaiKeyValid(false);
      toast({
        title: "Connection Error",
        description:
          "Failed to communicate with the server. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsTestingXaiKey(false);
    }
  };

  // Handler for removing xAI API key
  const handleRemoveXaiKey = async () => {
    try {
      const response = await fetch("/api/settings/xai-key", {
        method: "DELETE",
      });

      if (response.ok) {
        setHasXaiApiKey(false);
        setXaiApiKey("");
        setXaiKeyValid(null);

        toast({
          title: "API Key Removed",
          description: "Your xAI API key has been removed successfully.",
          variant: "default",
        });
      } else {
        toast({
          title: "Failed to Remove",
          description:
            "There was an error removing your API key. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error removing xAI API key:", error);
      toast({
        title: "Connection Error",
        description:
          "Failed to communicate with the server. Please try again later.",
        variant: "destructive",
      });
    }
  };

  if (isMobile) {
    return (
      <div className="settings-page max-w-4xl mx-auto px-4 pb-20 pt-6">
        <h1 className="text-2xl font-semibold mb-6">Settings</h1>
        <MobileSettings />
        <div className="mt-6">
          <EmailIngestInboxesSettings />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page max-w-4xl mx-auto px-4 pb-20 pt-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="grid gap-6">
        {/* Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose light, dark, or follow your system preference
                </p>
              </div>
              <ToggleGroup
                type="single"
                value={theme}
                onValueChange={(value) => {
                  if (value) setTheme(value as typeof theme);
                }}
              >
                <ToggleGroupItem value="light" aria-label="Light mode">
                  <Sun className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="system" aria-label="System preference">
                  <Monitor className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" aria-label="Dark mode">
                  <Moon className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>Display Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">British Pound (£)</SelectItem>
                  <SelectItem value="USD">US Dollar ($)</SelectItem>
                  <SelectItem value="EUR">Euro (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label>Date Format</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center">
                  <Bell className="h-4 w-4 mr-2" />
                  <Label htmlFor="email-notifications">
                    Email Notifications
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Receive updates and alerts via email
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center">
                  <Bell className="h-4 w-4 mr-2" />
                  <Label htmlFor="app-notifications">App Notifications</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Receive in-app notifications and alerts
                </p>
              </div>
              <Switch
                id="app-notifications"
                checked={appNotifications}
                onCheckedChange={setAppNotifications}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center">
                  <DatabaseBackup className="h-4 w-4 mr-2" />
                  <Label htmlFor="auto-updates">Automatic API Updates</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically update connected accounts
                </p>
              </div>
              <Switch
                id="auto-updates"
                checked={autoUpdates}
                onCheckedChange={setAutoUpdates}
              />
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data & Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-md font-medium mb-3">Export Your Data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Download a copy of your investment data in various formats
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                  onClick={() => handleDataExport("CSV")}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  CSV Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                  onClick={() => handleDataExport("JSON")}
                >
                  <FileJson className="h-4 w-4 mr-2" />
                  JSON Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                  onClick={() => handleDataExport("Excel")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Excel Export
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-md font-medium mb-2">Privacy & Terms</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="link" size="sm" className="text-primary p-0">
                  Privacy Policy
                </Button>
                <Button variant="link" size="sm" className="text-primary p-0">
                  Terms of Service
                </Button>
                <Button variant="link" size="sm" className="text-primary p-0">
                  Cookie Policy
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <Button
                variant="link"
                className="text-red-500 p-0 flex items-center"
              >
                Delete All My Data
              </Button>
            </div>
          </CardContent>
        </Card>

        <EmailIngestInboxesSettings />

        {/* API Integrations Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Key className="h-5 w-5 mr-2 text-primary" />
              API Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center mb-2">
                <Sparkles className="h-4 w-4 mr-2 text-blue-500" />
                <h3 className="text-md font-medium">xAI / Grok API</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Connect to the xAI Grok API to generate intelligent milestone
                suggestions based on your investment portfolio.
              </p>

              {hasXaiApiKey ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-600">
                      API Key Connected
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={handleRemoveXaiKey}
                    >
                      Remove API Key
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="xai-key">xAI API Key</Label>
                    <div className="flex">
                      <Input
                        id="xai-key"
                        type="password"
                        placeholder="Enter your xAI API key"
                        value={xaiApiKey}
                        onChange={(e) => setXaiApiKey(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSaveXaiKey}
                        className="ml-2"
                        disabled={isTestingXaiKey || !xaiApiKey.trim()}
                      >
                        {isTestingXaiKey ? <>Verifying...</> : <>Save Key</>}
                      </Button>
                    </div>
                    {xaiKeyValid === false && (
                      <p className="text-sm text-red-500 flex items-center mt-1">
                        <X className="h-4 w-4 mr-1" />
                        Invalid API key. Please check and try again.
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>
                      <a
                        href="https://x.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Get an API key from x.ai
                      </a>
                    </p>
                    <p className="mt-1">
                      Your API key is stored securely and never shared with
                      third parties.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <div className="flex items-center mb-2">
                <DatabaseBackup className="h-4 w-4 mr-2 text-blue-500" />
                <h3 className="text-md font-medium">Trading212 API</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                API keys for investment platforms can be managed in the API
                Connections page.
              </p>
              <Button
                variant="link"
                className="px-0 text-primary"
                onClick={() => (window.location.href = "/api-connections")}
              >
                Manage Trading Platform Connections
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help & Support Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Help & Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto flex items-center justify-center"
            >
              <LifeBuoy className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
            <p className="text-sm text-muted-foreground">
              Need help with Milestone? Our support team is available
              Monday-Friday, 9am-5pm GMT.
            </p>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveSettings} className="w-full sm:w-auto">
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
