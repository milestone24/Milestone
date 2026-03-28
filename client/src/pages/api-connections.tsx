import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useConnectAssetApi } from "@/hooks/use-connect-asset-api";
import {
  Link as LinkIcon,
  Unlink,
  Check,
  RefreshCw,
  Lock,
  Info,
  Briefcase,
} from "lucide-react";
import { SiTradingview, SiCoinbase } from "react-icons/si";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAssetWithHistoryAndAccountChange } from "@shared/schema";

export default function ApiConnections() {
  const connectAssetApi = useConnectAssetApi();
  const { toast } = useToast();

  // State for API dialog
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [apiKey, setApiKey] = useState("");

  // State for disconnect dialog
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] = useState<string | null>(
    null
  );

  // Helper to get logo for provider
  const getProviderLogo = (provider: string) => {
    switch (provider.toLowerCase()) {
      case "trading 212":
      case "trading212":
        return <SiTradingview className="w-6 h-6" />;
      case "vanguard":
        return <Briefcase className="w-6 h-6" />;
      case "invest engine":
      case "investengine":
        return <SiCoinbase className="w-6 h-6" />;
      default:
        return <SiTradingview className="w-6 h-6" />;
    }
  };

  // Open API connect dialog
  const openApiDialog = (accountId: string) => {
    setSelectedAccountId(accountId);
    setApiKey("");
    setApiDialogOpen(true);
  };

  // Open disconnect confirmation dialog
  const openDisconnectDialog = (accountId: string) => {
    setAccountToDisconnect(accountId);
    setDisconnectDialogOpen(true);
  };

  // Handle API connection
  const handleConnectApi = async () => {
    if (!selectedAccountId || !apiKey.trim()) return;

    try {
      await connectAssetApi.mutateAsync({ id: selectedAccountId, apiKey });
      setApiDialogOpen(false);
      toast({
        title: "API Connected",
        description:
          "Your account has been connected successfully. Values will now update automatically.",
      });
    } catch (error) {
      toast({
        title: "Error connecting API",
        description:
          "There was a problem connecting to the API. Please check your API key and try again.",
        variant: "destructive",
      });
    }
  };

  // Handle API disconnection (simulated)
  const handleDisconnectApi = async () => {
    if (!accountToDisconnect) return;

    // In a real app, we would disconnect the API here
    setDisconnectDialogOpen(false);
    toast({
      title: "API Disconnected",
      description: "Your account has been disconnected from the API.",
    });
  };

  // Determine which accounts support API connections
  const getApiStatus = (
    provider: string
  ): {
    supported: boolean;
    status: "connected" | "not-connected" | "beta" | "coming-soon";
    name: string;
  } => {
    const lowerProvider = provider.toLowerCase();

    if (lowerProvider === "trading212" || lowerProvider === "trading 212") {
      return {
        supported: true,
        status: "connected",
        name: "Trading212",
      };
    }

    if (lowerProvider === "vanguard") {
      return {
        supported: true,
        status: "beta",
        name: "Vanguard",
      };
    }

    if (lowerProvider === "investengine" || lowerProvider === "invest engine") {
      return {
        supported: true,
        status: "coming-soon",
        name: "InvestEngine",
      };
    }

    return {
      supported: false,
      status: "not-connected",
      name: provider,
    };
  };

  // Split accounts into connected and disconnected
  //const connectedAccounts: UserAssetWithHistoryAndAccountChange[] = assets.filter((acc) => acc.isPlatformAPIConencted);
  const connectedAccounts: UserAssetWithHistoryAndAccountChange[] = [];
  // const disconnectedAccounts: UserAssetWithHistoryAndAccountChange[] = assets.filter(
  //   (acc) => !acc.isPlatformAPIConencted && getApiStatus(acc.providerId).supported
  // );
  const disconnectedAccounts: UserAssetWithHistoryAndAccountChange[] = [];

  return (
    <div className="api-connections-page max-w-4xl mx-auto px-4 pb-20 pt-6">
      <h1 className="text-2xl font-semibold mb-4">API Connections</h1>
      <p className="text-muted-foreground mb-6">
        Connect your investment accounts to automatically update your portfolio
        values
      </p>

      {/* Connected accounts section */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-4 flex items-center">
          <Check className="w-5 h-5 mr-2 text-green-600" />
          Connected Accounts
        </h2>

        {connectedAccounts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="mb-4 text-muted-foreground">
                <LinkIcon className="w-12 h-12 mx-auto mb-2" />
                <h3 className="text-md font-medium">No Connected Accounts</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                You don't have any accounts connected via API yet. Connect your
                accounts to auto-update your portfolio values.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {/* {connectedAccounts.map((account) => {
              const apiInfo = getApiStatus(account.provider);

              return (
                <Card key={account.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center mr-4">
                          {getProviderLogo(account.provider)}
                        </div>
                        <div>
                          <h3 className="font-medium">{account.provider}</h3>
                          <div className="flex items-center text-sm text-gray-500">
                            <span>{account.accountType}</span>
                            <span className="mx-2">•</span>
                            <span>
                              Last updated:{" "}
                              {new Date(account.updatedAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center mt-1">
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-8">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Update Now
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => openDisconnectDialog(account.id)}
                        >
                          <Unlink className="w-4 h-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t text-sm text-gray-500">
                      <div className="flex items-center">
                        <Lock className="w-4 h-4 mr-2 text-gray-400" />
                        <p>
                          API keys are securely stored and used only for
                          fetching your account data.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })} */}
          </div>
        )}
      </div>

      {/* Available connections section */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-4">Available Connections</h2>

        {disconnectedAccounts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                All your compatible accounts are already connected.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {/* {disconnectedAccounts.map((account) => {
              const apiInfo = getApiStatus(account.provider);

              return (
                <Card key={account.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center mr-4">
                          {getProviderLogo(account.provider)}
                        </div>
                        <div>
                          <h3 className="font-medium">{account.provider}</h3>
                          <div className="text-sm text-gray-500">
                            <span>{account.accountType}</span>
                          </div>
                          <div className="flex items-center mt-1">
                            {apiInfo.status === "beta" ? (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200"
                              >
                                Beta
                              </Badge>
                            ) : apiInfo.status === "coming-soon" ? (
                              <Badge
                                variant="outline"
                                className="bg-orange-50 text-orange-700 border-orange-200"
                              >
                                Coming Soon
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-gray-100 text-gray-600"
                              >
                                Not Connected
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => openApiDialog(account.id)}
                        disabled={apiInfo.status === "coming-soon"}
                      >
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Connect API
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })} */}
          </div>
        )}
      </div>

      {/* Supported brokers section */}
      <div>
        <h2 className="text-lg font-medium mb-4">Supported Brokers</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Our API connections support the following brokers
            </CardTitle>
            <CardDescription>
              We're constantly adding support for more brokers and platforms.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center p-3 border rounded-md">
              <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center mr-3">
                <SiTradingview className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium">Trading212</h3>
                <div className="flex items-center">
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 text-xs"
                  >
                    Available Now
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center p-3 border rounded-md">
              <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center mr-3">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium">Vanguard</h3>
                <div className="flex items-center">
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                  >
                    Beta
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center p-3 border rounded-md">
              <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center mr-3">
                <SiCoinbase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium">InvestEngine</h3>
                <div className="flex items-center">
                  <Badge
                    variant="outline"
                    className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                  >
                    Coming Soon
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Connection Dialog */}
      <Dialog open={apiDialogOpen} onOpenChange={setApiDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect API</DialogTitle>
            <DialogDescription>
              Enter your API key to automatically sync your account values.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-sm">
                API Key
              </Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-start mt-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  To find your API key, log in to your broker's website, go to
                  settings, and look for API access or developer options.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApiDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnectApi} disabled={!apiKey.trim()}>
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect API?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the API connection for this account. Your
              data will no longer update automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnectApi}
              className="bg-red-600 hover:bg-red-700"
            >
              <Unlink className="w-4 h-4 mr-2" />
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
