import { useState, useEffect, useRef } from "react";
import {
  Camera,
  Upload,
  X,
  Loader2,
  Check,
  Edit2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserAsset } from "@milestone/js-common/schema";
import { getPlatformName } from "@/lib/platform";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";

interface ScreenshotUploadProps {
  assets: UserAsset[];
  onExtractedValues: (data: { assetId: string; value: number }[]) => void;
}

// Define types for analysis results
interface AnalysisResult {
  imageIndex: number;
  extractedData: Array<{
    accountName: string;
    accountType?: string;
    amount: number;
    confidence: number;
    isVerified?: boolean;
  }>;
  isProcessed: boolean;
  isEdited?: boolean;
}

// Interface for extracted values with editing
interface ExtractedValue {
  originalData: {
    accountName: string;
    accountType?: string;
    amount: number;
    confidence: number;
  };
  matchedAssetId?: string;
  editedValue?: number;
  editedProviderId?: string;
  editedAccountType?: string;
  isVerified?: boolean;
}

export function ScreenshotUpload({
  assets,
  onExtractedValues,
}: ScreenshotUploadProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [editingExtractedValue, setEditingExtractedValue] = useState<{
    imageIndex: number;
    resultIndex: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { data: brokerPlatforms } = useBrokerPlatforms();

  // Format currency with 2 decimal places
  const formatCurrency = (value: number): string => {
    return value.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Get the account types for a provider
  const getAccountTypesForProvider = (providerId: string): string[] => {
    const provider = brokerPlatforms?.find((p) => p.id === providerId);
    return provider?.supportedAccountTypes || [];
  };

  // Get a clean asset name from the database name
  const getCleanAssetName = (asset: UserAsset | undefined): string => {
    if (!asset) return "Unknown Account";

    // If asset name contains duplicated words (like "ISA ISA"), clean it up
    const name = asset.name.trim();
    const words = name.split(/\s+/);
    if (words.length > 1 && words[0] === words[1]) {
      return words[0]!;
    }
    return name;
  };

  // Check if we have any unmatched accounts
  const hasUnmatchedAccounts = (): boolean => {
    for (const result of analysisResults) {
      for (const item of result.extractedData) {
        const matchingAsset = findMatchingAsset(
          item.accountName,
          item.accountType
        );
        if (!matchingAsset) {
          return true;
        }
      }
    }
    return false;
  };

  // Handle file upload
  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const newImages: string[] = [];
    const fileArray = Array.from(files);

    fileArray.forEach((file) => {
      if (!file.type.match("image.*")) {
        toast({
          title: "Invalid file type",
          description: "Please upload image files only (JPG, PNG, etc.)",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result && typeof result === "string") {
          newImages.push(result);
          setUploadedImages((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Remove an image from the list
  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    setAnalysisResults((prev) =>
      prev.filter((result) => result.imageIndex !== index)
    );
  };

  // Resize and pre-process an image to improve OCR results
  const processImageForOCR = (
    base64Image: string,
    maxWidth = 800,
    maxHeight = 800
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions if the image is too large
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Create a canvas to process the image
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Draw the resized image on the canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Apply image processing to enhance text visibility
        try {
          // Get the image data
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;

          // Enhance contrast slightly to make text more readable
          for (let i = 0; i < data.length; i += 4) {
            // Apply a simple contrast enhancement
            // This can help OCR with text recognition

            data[i] =
              /**@ts-ignore */
              data[i] < 120 ? data[i] * 0.8 : Math.min(255, data[i] * 1.2); // red
            data[i + 1] =
              /**@ts-ignore */
              data[i + 1] < 120
                ? /**@ts-ignore */
                  data[i + 1] * 0.8
                : /**@ts-ignore */
                  Math.min(255, data[i + 1] * 1.2); // green
            data[i + 2] =
              /**@ts-ignore */
              data[i + 2] < 120
                ? /**@ts-ignore */
                  data[i + 2] * 0.8
                : /**@ts-ignore */
                  Math.min(255, data[i + 2] * 1.2); // blue
            // Alpha channel unchanged
          }

          // Put the modified image data back
          ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          console.warn(
            "Image processing enhancement failed, continuing with basic resize:",
            e
          );
          // If image processing fails, just continue with the resized image
        }

        // Convert the canvas back to a base64 string at a reduced quality
        const processedBase64 = canvas.toDataURL("image/jpeg", 0.85);

        resolve(processedBase64);
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      img.src = base64Image;
    });
  };

  // Start editing a value
  const startEditing = (imageIndex: number, resultIndex: number) => {
    setEditingExtractedValue({ imageIndex, resultIndex });
  };

  // Mark a value as verified
  const markAsVerified = (imageIndex: number, resultIndex: number) => {
    setAnalysisResults((prev) =>
      prev.map((result, i) =>
        i === imageIndex
          ? {
              ...result,
              extractedData: result.extractedData.map((item, j) =>
                j === resultIndex ? { ...item, isVerified: true } : item
              ),
            }
          : result
      )
    );

    toast({
      title: "Thank you!",
      description: "Verifying correct entries helps us to improve the AI.",
    });
  };

  // Update the extracted value with edited data
  const updateExtractedValue = (
    imageIndex: number,
    resultIndex: number,
    updates: {
      providerId?: string;
      accountType?: string;
      value?: number;
    }
  ) => {
    setAnalysisResults((prev) =>
      prev.map((result, i) =>
        i === imageIndex
          ? {
              ...result,
              isEdited: true,
              extractedData: result.extractedData.map((item, j) =>
                j === resultIndex
                  ? {
                      ...item,
                      ...(updates.providerId && brokerPlatforms
                        ? {
                            accountName: getPlatformName(
                              updates.providerId,
                              brokerPlatforms
                            ),
                          }
                        : {}),
                      ...(updates.accountType
                        ? { accountType: updates.accountType }
                        : {}),
                      ...(updates.value !== undefined
                        ? { amount: updates.value }
                        : {}),
                    }
                  : item
              ),
            }
          : result
      )
    );
  };

  // Find the best matching asset for an extracted account
  const findMatchingAsset = (providerName: string, accountType?: string) => {
    // First try to match by both provider name and account type
    if (accountType) {
      const exactMatch = assets.find(
        (asset) =>
          brokerPlatforms &&
          asset.platformId &&
          getPlatformName(asset.platformId, brokerPlatforms).toLowerCase() ===
            providerName.toLowerCase() &&
          asset.accountType.toUpperCase() === accountType.toUpperCase()
      );

      if (exactMatch) return exactMatch;
    }

    // Then try matching just by provider
    return assets.find(
      (asset) =>
        brokerPlatforms &&
        asset.platformId &&
        getPlatformName(asset.platformId, brokerPlatforms).toLowerCase() ===
          providerName.toLowerCase()
    );
  };

  // Save all extracted values and apply to record
  const saveExtractedValues = () => {
    // Check for unmatched accounts first
    if (hasUnmatchedAccounts()) {
      toast({
        title: "Unmatched accounts",
        description:
          "Please add missing accounts to your portfolio before saving.",
        variant: "destructive",
      });
      return;
    }

    // Collect all extractedData with matched assets
    const valuesToSave: { assetId: string; value: number }[] = [];

    analysisResults.forEach((result) => {
      result.extractedData.forEach((extractedItem) => {
        const matchingAsset = findMatchingAsset(
          extractedItem.accountName,
          extractedItem.accountType
        );

        if (matchingAsset) {
          valuesToSave.push({
            assetId: matchingAsset.id,
            value: extractedItem.amount,
          });
        }
      });
    });

    if (valuesToSave.length === 0) {
      toast({
        title: "No matching assets",
        description:
          "We couldn't match the extracted values to any of your accounts. Please verify the provider and account type.",
        variant: "destructive",
      });
      return;
    }

    // Pass values to parent component
    onExtractedValues(valuesToSave);

    // Show success toast
    toast({
      title: "Values saved",
      description: `Updated ${valuesToSave.length} account values successfully.`,
    });

    // Close dialog and reset state
    setIsDialogOpen(false);
    setUploadedImages([]);
    setAnalysisResults([]);
  };

  // Process the uploaded images
  const processImages = async () => {
    if (uploadedImages.length === 0) {
      toast({
        title: "No images to process",
        description: "Please upload at least one screenshot to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Get all provider names for our active accounts
      const platformNames = assets.map((asset) =>
        getPlatformName(asset.platformId ?? "", brokerPlatforms ?? [])
      );

      // Clear previous analysis results
      setAnalysisResults([]);

      // Process each image and get the results
      const results = await Promise.all(
        uploadedImages.map(async (imageData, imageIndex) => {
          try {
            // Process the image before sending it to the server (resize + enhance for OCR)
            const processedImage = await processImageForOCR(
              imageData,
              800,
              800
            );
            console.log(
              `Original image size: ~${Math.round(
                imageData.length / 1024
              )}KB, Processed: ~${Math.round(processedImage.length / 1024)}KB`
            );

            const response = await fetch("/api/ocr/extract-values", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                imageData: processedImage,
                providerNames: Array.from(new Set(platformNames)),
              }),
            });

            if (!response.ok) {
              try {
                const errorData = await response.json();
                console.error("API error response:", errorData);
                throw new Error(
                  `HTTP error! status: ${response.status} - ${
                    errorData.error || "Unknown error"
                  }`
                );
              } catch (e) {
                // If we can't parse the error as JSON, just use the status
                console.error("API error (unparseable):", e);
                throw new Error(`HTTP error! status: ${response.status}`);
              }
            }

            // Parse and log the response
            let data;
            try {
              const responseText = await response.text();
              console.log("Raw API response:", responseText);
              data = JSON.parse(responseText);
              console.log("Parsed API response:", data);
            } catch (parseError) {
              console.error("Error parsing API response:", parseError);
              throw new Error("Failed to parse API response");
            }

            // Make sure extractedValues exists and is an array
            const extractedValues = Array.isArray(data.extractedValues)
              ? data.extractedValues
              : [];

            // Store this image's analysis results
            setAnalysisResults((prev) => [
              ...prev,
              {
                imageIndex,
                extractedData: extractedValues,
                isProcessed: true,
              },
            ]);

            return extractedValues;
          } catch (error) {
            console.error("Error processing image:", error);

            // Store empty result for this image
            setAnalysisResults((prev) => [
              ...prev,
              {
                imageIndex,
                extractedData: [],
                isProcessed: true,
              },
            ]);

            return [];
          }
        })
      );

      // Check if we found any values
      const allResults = results.flat();

      if (allResults.length === 0) {
        toast({
          title: "No account values detected",
          description:
            "We couldn't identify any account values in your screenshots. Please try again with clearer images.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Account values detected",
          description: `Found ${allResults.length} account values. Review the matches and edit if needed before saving.`,
        });
      }
    } catch (error) {
      console.error("Error in image processing:", error);
      toast({
        title: "Processing error",
        description:
          "An error occurred while processing your screenshots. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2 text-primary border-primary hover:bg-primary hover:text-white"
        onClick={() => setIsDialogOpen(true)}
      >
        <Camera size={16} />
        <span>Upload Screenshots</span>
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Upload Account Screenshots</DialogTitle>
            <DialogDescription>
              Take screenshots of your account balances and upload them here to
              automatically fill in the values. The AI will try to identify your
              accounts by provider name, account type (ISA, SIPP, etc.), and
              balance amount. This feature is still in beta and is experimental*
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(80vh-150px)]">
            <div className="px-1 py-2">
              <div
                className={`
                  p-6 border-2 border-dashed rounded-md transition-colors
                  ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }
                `}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload size={32} className="text-muted-foreground" />
                  <p className="text-sm text-center text-muted-foreground">
                    Drag and drop your screenshots here, or click to browse
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleUploadClick}
                    disabled={isProcessing}
                  >
                    Browse Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <div className="mt-2 space-y-1">
                <p className="text-xs italic text-muted-foreground">
                  *We do not store screenshots for security reasons - they are
                  simply read by the AI using OCR to get the figures to make the
                  input process easier for you
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Tip:</strong> For best results, ensure your
                  screenshots clearly show both the account name/type (ISA,
                  SIPP, etc.) and current balance.
                </p>
              </div>

              {/* Images and analysis results */}
              {uploadedImages.length > 0 && (
                <div className="mt-4 space-y-4">
                  {uploadedImages.map((img, index) => {
                    const result = analysisResults.find(
                      (r) => r.imageIndex === index
                    );

                    return (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex mb-2 items-center justify-between">
                          <div className="flex">
                            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-medium">
                              {index + 1}
                            </div>
                            <h4 className="text-sm font-medium ml-2">
                              Screenshot {index + 1}
                            </h4>
                          </div>

                          {hasUnmatchedAccounts() && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center text-xs text-amber-600">
                                    <AlertCircle size={14} className="mr-1" />
                                    <span>Unmatched accounts</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[250px]">
                                    Some accounts don't match your portfolio.
                                    Please add these accounts before saving.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                          {/* Left column - Screenshot (smaller) with number indicator */}
                          <div className="md:w-1/3 relative">
                            <img
                              src={img}
                              alt={`Screenshot ${index + 1}`}
                              className="w-full rounded-md border border-border object-contain"
                              style={{ maxHeight: "180px" }}
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                              onClick={() => removeImage(index)}
                              disabled={isProcessing}
                            >
                              <X size={12} />
                            </Button>
                          </div>

                          {/* Right column - Extracted data (larger) with editable fields */}
                          <div className="md:w-2/3 flex flex-col">
                            {isProcessing && !result && (
                              <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                                <span className="text-sm">Processing...</span>
                              </div>
                            )}

                            {!isProcessing && !result && (
                              <div className="text-sm text-muted-foreground border border-dashed rounded-md p-3 flex-grow flex items-center justify-center">
                                <p>
                                  Click "Extract Account Values" to analyze this
                                  screenshot
                                </p>
                              </div>
                            )}

                            {result && (
                              <>
                                {result.extractedData.length === 0 ? (
                                  <div className="text-sm text-red-500 border border-dashed border-red-200 rounded-md p-3 flex-grow flex items-center justify-center">
                                    <p>
                                      No account information detected in this
                                      screenshot.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {result.extractedData.map(
                                      (extractedItem, resultIndex) => {
                                        const isEditing =
                                          editingExtractedValue?.imageIndex ===
                                            index &&
                                          editingExtractedValue?.resultIndex ===
                                            resultIndex;
                                        const isVerified =
                                          "isVerified" in extractedItem &&
                                          extractedItem.isVerified;

                                        // Find matching asset for this extracted item
                                        const matchingAsset = findMatchingAsset(
                                          extractedItem.accountName,
                                          extractedItem.accountType
                                        );

                                        // Get provider ID based on name
                                        const providerId =
                                          matchingAsset?.providerId ||
                                          brokerPlatforms?.find(
                                            (p) =>
                                              p.name.toLowerCase() ===
                                              extractedItem.accountName.toLowerCase()
                                          )?.id;

                                        const hasNoMatch = !matchingAsset;

                                        const confidenceClass = hasNoMatch
                                          ? "border-amber-300 bg-amber-50"
                                          : isVerified
                                          ? "border-green-300 bg-green-50"
                                          : result.isEdited
                                          ? "border-blue-300 bg-blue-50"
                                          : extractedItem.confidence > 0.7
                                          ? "border-green-200 bg-green-50"
                                          : "border-yellow-200 bg-yellow-50";

                                        return (
                                          <div
                                            key={resultIndex}
                                            className={`border rounded-md p-3 ${confidenceClass}`}
                                          >
                                            {hasNoMatch && (
                                              <div className="mb-2 bg-amber-100 p-2 rounded-sm text-xs text-amber-800 flex items-center">
                                                <AlertCircle
                                                  size={12}
                                                  className="mr-1 flex-shrink-0"
                                                />
                                                <span>
                                                  This account doesn't currently
                                                  match any in your portfolio.
                                                  Please add it before saving.
                                                </span>
                                              </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-2 mb-1">
                                              <div className="text-xs font-medium">
                                                Provider:
                                              </div>
                                              <div className="text-xs">
                                                {isEditing ? (
                                                  <Select
                                                    defaultValue={providerId}
                                                    onValueChange={(value) => {
                                                      updateExtractedValue(
                                                        index,
                                                        resultIndex,
                                                        {
                                                          providerId: value,
                                                        }
                                                      );
                                                    }}
                                                  >
                                                    <SelectTrigger className="h-7 text-xs">
                                                      <SelectValue placeholder="Select provider" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {brokerPlatforms?.map(
                                                        (provider) => (
                                                          <SelectItem
                                                            key={provider.id}
                                                            value={provider.id}
                                                          >
                                                            {provider.name}
                                                          </SelectItem>
                                                        )
                                                      )}
                                                    </SelectContent>
                                                  </Select>
                                                ) : (
                                                  extractedItem.accountName
                                                )}
                                              </div>

                                              <div className="text-xs font-medium">
                                                Account Type:
                                              </div>
                                              <div className="text-xs">
                                                {isEditing ? (
                                                  <Select
                                                    defaultValue={
                                                      extractedItem.accountType
                                                    }
                                                    onValueChange={(value) => {
                                                      updateExtractedValue(
                                                        index,
                                                        resultIndex,
                                                        {
                                                          accountType: value,
                                                        }
                                                      );
                                                    }}
                                                  >
                                                    <SelectTrigger className="h-7 text-xs">
                                                      <SelectValue placeholder="Select account type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {(providerId
                                                        ? getAccountTypesForProvider(
                                                            providerId
                                                          )
                                                        : []
                                                      ).map((type) => (
                                                        <SelectItem
                                                          key={type}
                                                          value={type}
                                                        >
                                                          {type}
                                                        </SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                ) : (
                                                  extractedItem.accountType ||
                                                  "Unknown"
                                                )}
                                              </div>

                                              <div className="text-xs font-medium">
                                                Value:
                                              </div>
                                              <div className="text-xs">
                                                {isEditing ? (
                                                  <div className="flex items-center">
                                                    <span className="mr-1">
                                                      £
                                                    </span>
                                                    <Input
                                                      type="text"
                                                      defaultValue={extractedItem.amount.toFixed(
                                                        2
                                                      )}
                                                      onChange={(e) => {
                                                        const value =
                                                          parseFloat(
                                                            e.target.value
                                                          );
                                                        if (!isNaN(value)) {
                                                          updateExtractedValue(
                                                            index,
                                                            resultIndex,
                                                            { value }
                                                          );
                                                        }
                                                      }}
                                                      className="h-7 text-xs w-24"
                                                    />
                                                  </div>
                                                ) : (
                                                  `£${formatCurrency(
                                                    extractedItem.amount
                                                  )}`
                                                )}
                                              </div>

                                              <div className="text-xs font-medium">
                                                Match:
                                              </div>
                                              <div className="text-xs">
                                                {matchingAsset ? (
                                                  <span className="text-green-600">
                                                    {getCleanAssetName(
                                                      matchingAsset
                                                    )}
                                                  </span>
                                                ) : (
                                                  <span className="text-amber-600">
                                                    No matching account
                                                  </span>
                                                )}
                                              </div>

                                              <div className="text-xs font-medium">
                                                Confidence:
                                              </div>
                                              <div className="text-xs">
                                                {(
                                                  extractedItem.confidence * 100
                                                ).toFixed(0)}
                                                %
                                                {extractedItem.confidence <
                                                  0.7 &&
                                                  !isVerified && (
                                                    <span className="text-yellow-600 ml-1">
                                                      (Low)
                                                    </span>
                                                  )}
                                              </div>
                                            </div>

                                            <div className="flex justify-end items-center gap-2 mt-2">
                                              <div className="text-xs flex-1">
                                                {isVerified && (
                                                  <span className="text-green-600 flex items-center gap-1">
                                                    <Check size={12} />
                                                    <span>Verified</span>
                                                  </span>
                                                )}
                                              </div>

                                              {isEditing ? (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-7 text-xs"
                                                  onClick={() =>
                                                    setEditingExtractedValue(
                                                      null
                                                    )
                                                  }
                                                >
                                                  Done
                                                </Button>
                                              ) : (
                                                <>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() =>
                                                      startEditing(
                                                        index,
                                                        resultIndex
                                                      )
                                                    }
                                                  >
                                                    <Edit2
                                                      size={12}
                                                      className="mr-1"
                                                    />{" "}
                                                    Edit
                                                  </Button>

                                                  {!isVerified && (
                                                    <Button
                                                      variant="default"
                                                      size="sm"
                                                      className="h-7 text-xs bg-primary text-white hover:bg-primary/90"
                                                      onClick={() =>
                                                        markAsVerified(
                                                          index,
                                                          resultIndex
                                                        )
                                                      }
                                                    >
                                                      <Check
                                                        size={12}
                                                        className="mr-1"
                                                      />{" "}
                                                      Correct
                                                    </Button>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex flex-wrap justify-between mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setUploadedImages([]);
                setAnalysisResults([]);
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>

            <div className="flex gap-2">
              {analysisResults.some((r) => r.extractedData.length > 0) && (
                <Button
                  onClick={saveExtractedValues}
                  className="gap-2 bg-primary text-white hover:bg-primary/90"
                  disabled={hasUnmatchedAccounts()}
                >
                  Save
                </Button>
              )}

              <Button
                onClick={processImages}
                disabled={uploadedImages.length === 0 || isProcessing}
                className="gap-2"
                variant="outline"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  "Extract Account Values"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
