import { useState, useEffect } from 'react';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getData, storeData, triggerHapticFeedback, isNativePlatform } from "../../capacitor";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";

/**
 * Mobile-specific settings component with haptic feedback
 * and persistent storage for preferences
 */
export default function MobileSettings() {
  const { theme, setTheme } = useTheme();
  const [enableOfflineMode, setEnableOfflineMode] = useState(false);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [dataFreshness, setDataFreshness] = useState("1h");
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [biometricAuth, setBiometricAuth] = useState(false);
  const [exportDataOpen, setExportDataOpen] = useState(false);
  const [exportEmail, setExportEmail] = useState("");

  // Load preferences from Capacitor storage on mount
  useEffect(() => {
    const loadPreferences = async () => {
      setIsMobileDevice(isNativePlatform());
      
      const offlineMode = await getData<boolean>("offlineMode");
      if (offlineMode !== null) setEnableOfflineMode(offlineMode);
      
      const notifications = await getData<boolean>("notifications");
      if (notifications !== null) setEnableNotifications(notifications);
      
      const freshness = await getData<string>("dataFreshness");
      if (freshness !== null) setDataFreshness(freshness);
      
      const bioAuth = await getData<boolean>("biometricAuth");
      if (bioAuth !== null) setBiometricAuth(bioAuth);
    };
    
    loadPreferences();
  }, []);

  // Handle toggle changes with haptic feedback
  const handleToggleChange = async (
    setter: React.Dispatch<React.SetStateAction<boolean>>, 
    value: boolean, 
    key: string
  ) => {
    setter(value);
    await storeData(key, value);
    triggerHapticFeedback();
  };

  const handleFreshnessChange = async (value: string) => {
    setDataFreshness(value);
    await storeData("dataFreshness", value);
    triggerHapticFeedback();
  };

  const handleExportData = () => {
    // This would actually trigger the data export process
    // In a real implementation, this would generate a file and send it
    console.log(`Exporting data to ${exportEmail}`);
    setExportDataOpen(false);
    triggerHapticFeedback();
  };

  if (!isMobileDevice) {
    return null; // Don't render on non-mobile platforms
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mobile Settings</CardTitle>
          <CardDescription>Configure your mobile experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="offline-mode">Offline Mode</Label>
              <p className="text-sm text-muted-foreground">
                Store data locally for offline access
              </p>
            </div>
            <Switch
              id="offline-mode"
              checked={enableOfflineMode}
              onCheckedChange={(value) => handleToggleChange(setEnableOfflineMode, value, "offlineMode")}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates about your investments
              </p>
            </div>
            <Switch
              id="notifications"
              checked={enableNotifications}
              onCheckedChange={(value) => handleToggleChange(setEnableNotifications, value, "notifications")}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Light, dark, or system preference
              </p>
            </div>
            <ToggleGroup
              type="single"
              value={theme}
              onValueChange={(value) => {
                if (value) {
                  setTheme(value as typeof theme);
                  triggerHapticFeedback();
                }
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
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="biometric-auth">Biometric Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Use fingerprint or face recognition
              </p>
            </div>
            <Switch
              id="biometric-auth"
              checked={biometricAuth}
              onCheckedChange={(value) => handleToggleChange(setBiometricAuth, value, "biometricAuth")}
            />
          </div>
        </CardContent>
      </Card>
      
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="data-settings">
          <AccordionTrigger className="bg-card p-4 rounded-lg">
            Data Settings
          </AccordionTrigger>
          <AccordionContent className="p-4 bg-background rounded-lg mt-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Data Refresh Frequency</Label>
                <div className="flex space-x-2">
                  <Button 
                    variant={dataFreshness === "15m" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFreshnessChange("15m")}
                  >
                    15 min
                  </Button>
                  <Button 
                    variant={dataFreshness === "1h" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFreshnessChange("1h")}
                  >
                    1 hour
                  </Button>
                  <Button 
                    variant={dataFreshness === "4h" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFreshnessChange("4h")}
                  >
                    4 hours
                  </Button>
                  <Button 
                    variant={dataFreshness === "1d" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFreshnessChange("1d")}
                  >
                    Daily
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Dialog open={exportDataOpen} onOpenChange={setExportDataOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      Export My Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Export Portfolio Data</DialogTitle>
                      <DialogDescription>
                        We'll send your data as a CSV file to your email.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                          id="email"
                          placeholder="Enter your email"
                          type="email"
                          value={exportEmail}
                          onChange={(e) => setExportEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => setExportDataOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        onClick={handleExportData}
                        disabled={!exportEmail}
                      >
                        Export
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <Card>
        <CardHeader>
          <CardTitle>About This App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">Version 1.0.0</p>
          <p className="text-sm text-muted-foreground">
            Milestone - Investment Tracking App
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="link" className="px-0">Privacy Policy</Button>
          <span className="mx-2">•</span>
          <Button variant="link" className="px-0">Terms of Service</Button>
        </CardFooter>
      </Card>
    </div>
  );
}