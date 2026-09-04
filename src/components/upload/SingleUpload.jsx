import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Camera, Upload, Loader2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { createExpense, getExpenses, getTrips, uploadUserFile } from "@/lib/localStorage";

import CameraCapture from "./CameraCapture";
import ExpensePreview from "./ExpensePreview";

const EXPENSE_SCHEMA = {
  "type": "object",
  "properties": {
    "vendor": {
      "type": "string",
      "description": "Merchant or vendor name"
    },
    "amount": {
      "type": "number",
      "description": "Total amount"
    },
    "currency": {
      "type": "string",
      "description": "Currency code"
    },
    "date": {
      "type": "string",
      "format": "date",
      "description": "Transaction date"
    },
    "category": {
      "type": "string",
      "description": "Expense category"
    },
    "payment_method": {
      "type": "string",
      "description": "Payment method used"
    },
    "description": {
      "type": "string",
      "description": "Additional notes or description"
    },
    "items": {
      "type": "array",
      "description": "Line items from the receipt",
      "items": {
        "type": "object",
        "properties": {
          "description": {
            "type": "string"
          },
          "quantity": {
            "type": "number"
          },
          "unit_price": {
            "type": "number"
          },
          "total": {
            "type": "number"
          }
        }
      }
    },
    "tax": {
      "type": "number",
      "description": "Tax amount"
    }
  }
};

export default function SingleUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const fileInputRef = useRef(null);

  const { data: trips = [] } = useQuery({
    queryKey: ['trips', user?.id],
    queryFn: () => getTrips(user.id),
    enabled: !!user?.id,
  });

  const checkForDuplicates = async (expenseData) => {
    try {
      const existing = await getExpenses(user?.id);
      return existing.some((item) =>
        item.vendor === expenseData.vendor &&
        Number(item.amount) === Number(expenseData.amount) &&
        item.date === expenseData.date
      );
    } catch (error) {
      console.error("Duplicate check error:", error);
      return false;
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleCameraCapture = (capturedFile) => {
    setShowCamera(false);
    processFile(capturedFile);
  };

  const processFile = async (selectedFile) => {
    if (!user?.id) {
      toast.error("Zaloguj się, aby wgrać plik.");
      return;
    }
    setFile(selectedFile);
    setProcessing(true);
    setProgress(20);
    setDuplicateWarning(null);

    try {
      const receipt_url = await uploadUserFile(user.id, selectedFile, "receipts");
      setProgress(100);
      setExtractedData({
        vendor: "",
        amount: 0,
        currency: "USD",
        date: new Date().toISOString().split("T")[0],
        category: "Other",
        description: selectedFile.name,
        receipt_url,
        items: [],
        tax: 0,
      });
    } catch (error) {
      console.error("Error processing receipt:", error);
      toast.error("Nie udało się wgrać pliku. Spróbuj ponownie.");
      resetUpload();
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async (expenseData) => {
    if (!user?.id) {
      toast.error("Zaloguj się, aby zapisać.");
      return;
    }
    try {
      const isDuplicate = await checkForDuplicates(expenseData);
      if (isDuplicate) {
        setDuplicateWarning("Podobny wpis już istnieje (ten sam sprzedawca, kwota i data).");
      }
      await createExpense(user.id, expenseData);
      toast.success("Zapisano.");
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error("Nie udało się zapisać. Spróbuj ponownie.");
    }
  };

  const resetUpload = () => {
    setFile(null);
    setExtractedData(null);
    setProgress(0);
    setDuplicateWarning(null);
  };

  if (extractedData) {
    return (
      <div className="space-y-4">
        {duplicateWarning && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-300 text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription>{duplicateWarning}</AlertDescription>
          </Alert>
        )}
        <ExpensePreview
          data={extractedData}
          onSave={handleSave}
          onCancel={resetUpload}
          trips={trips}
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Upload a Single Receipt</h3>
          <p className="text-slate-600">Take a photo or upload an image of your receipt</p>
        </div>

        {processing ? (
          <Card className="border-2 border-dashed border-border bg-muted/30 p-6 sm:p-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-12 sm:w-16 h-12 sm:h-16 text-primary animate-spin mb-4" />
              <p className="text-base sm:text-lg font-medium text-slate-900 mb-2 text-center">Processing Receipt...</p>
              <p className="text-sm text-slate-600 mb-4 text-center">AI is extracting data from your receipt</p>
              <div className="w-48 sm:w-64 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">{progress}%</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Card 
              className="border-2 border-dashed border-border hover:border-primary/50 transition-all duration-200 cursor-pointer p-6 sm:p-8 bg-card"
              onClick={() => setShowCamera(true)}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 sm:w-20 h-16 sm:h-20 bg-muted rounded-full flex items-center justify-center mb-3 sm:mb-4">
                  <Camera className="w-8 sm:w-10 h-8 sm:h-10 text-muted-foreground" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">Take Photo</h3>
                <p className="text-sm text-slate-600">Use your camera to capture the receipt</p>
              </div>
            </Card>

            <Card 
              className="border-2 border-dashed border-border hover:border-primary/50 transition-all duration-200 cursor-pointer p-6 sm:p-8 bg-card"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 sm:w-20 h-16 sm:h-20 bg-muted rounded-full flex items-center justify-center mb-3 sm:mb-4">
                  <Upload className="w-8 sm:w-10 h-8 sm:h-10 text-muted-foreground" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">Upload File</h3>
                <p className="text-sm text-slate-600">Choose an image or PDF from your device</p>
              </div>
            </Card>
          </div>
        )}

        <div className="bg-muted/40 border border-border rounded-md p-4">
          <p className="text-sm text-foreground">
            <strong>Tip:</strong> For best results, ensure the receipt is well-lit and all text is clearly visible.
          </p>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
}