import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { createExpense, getExpenses, uploadUserFile } from "@/lib/localStorage";

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

export default function BulkUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const isValidFile = (file) => {
    const validTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/pdf'
    ];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    const fileName = file.name.toLowerCase();
    
    return validTypes.includes(file.type) || 
           validExtensions.some(ext => fileName.endsWith(ext));
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(isValidFile);
    
    if (selectedFiles.length === 0) {
      alert('Please select valid image files (JPG, JPEG, PNG) or PDF files');
      return;
    }
    
    if (selectedFiles.length < e.target.files.length) {
      alert(`${e.target.files.length - selectedFiles.length} file(s) were skipped. Only JPG, JPEG, PNG, and PDF files are supported.`);
    }
    
    setFiles(selectedFiles);
    setResults(selectedFiles.map(() => ({ status: 'pending' })));
    setDuplicatesCount(0);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isValidFile);
    
    if (droppedFiles.length === 0) {
      alert('Please drop valid image files (JPG, JPEG, PNG) or PDF files');
      return;
    }
    
    if (droppedFiles.length < e.dataTransfer.files.length) {
      alert(`${e.dataTransfer.files.length - droppedFiles.length} file(s) were skipped. Only JPG, JPEG, PNG, and PDF files are supported.`);
    }
    
    setFiles(droppedFiles);
    setResults(droppedFiles.map(() => ({ status: 'pending' })));
    setDuplicatesCount(0);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResults(prev => prev.filter((_, i) => i !== index));
  };

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

  const processFiles = async () => {
    if (!user?.id) {
      toast.error("Zaloguj się, aby wgrać pliki.");
      return;
    }
    setProcessing(true);
    setDuplicatesCount(0);

    try {
      for (let index = 0; index < files.length; index += 1) {
        setCurrentIndex(index);
        setResults((prev) => prev.map((item, i) => (i === index ? { status: "processing" } : item)));
        const selectedFile = files[index];
        try {
          const receipt_url = await uploadUserFile(user.id, selectedFile, "receipts");
          const expenseData = {
            vendor: selectedFile.name.replace(/\.[^.]+$/, ""),
            amount: 0,
            currency: "USD",
            date: new Date().toISOString().split("T")[0],
            category: "Other",
            description: selectedFile.name,
            receipt_url,
          };
          const isDuplicate = await checkForDuplicates(expenseData);
          if (isDuplicate) {
            setDuplicatesCount((count) => count + 1);
            setResults((prev) => prev.map((item, i) => (i === index ? { status: "duplicate" } : item)));
            continue;
          }
          await createExpense(user.id, expenseData);
          setResults((prev) => prev.map((item, i) => (i === index ? { status: "success" } : item)));
        } catch (error) {
          console.error("Bulk upload file error:", error);
          setResults((prev) => prev.map((item, i) => (
            i === index ? { status: "error", error: error.message || "Upload failed" } : item
          )));
        }
      }
      toast.success("Przesyłanie zakończone.");
    } catch (error) {
      console.error("Bulk upload error:", error);
      toast.error("Nie udało się przetworzyć plików.");
    } finally {
      setProcessing(false);
    }
  };

  const isComplete = results.length > 0 && results.every(r => r.status === 'success' || r.status === 'error' || r.status === 'duplicate');
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Bulk Upload Receipts</h3>
        <p className="text-slate-600">Upload multiple receipts at once for automatic processing</p>
        <p className="text-sm text-slate-500 mt-2">Supported formats: JPG, JPEG, PNG, PDF</p>
      </div>

      {duplicatesCount > 0 && (
        <Alert className="bg-amber-50 border-amber-300">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            {duplicatesCount} duplicate receipt{duplicatesCount > 1 ? 's' : ''} detected and skipped (same vendor, amount, and date already exists).
          </AlertDescription>
        </Alert>
      )}

      {files.length === 0 ? (
        <Card
          className={`border-2 border-dashed transition-all duration-200 cursor-pointer p-16 ${
            dragActive 
              ? 'border-primary bg-primary/10' 
              : 'border-border hover:border-primary/40 bg-card'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center text-center px-4 sm:px-0">
            <div className="w-20 sm:w-24 h-20 sm:h-24 bg-muted rounded-full flex items-center justify-center mb-4 sm:mb-6">
              <Upload className="w-10 sm:w-12 h-10 sm:h-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">
              {dragActive ? 'Drop files here' : 'Drop files here or click to upload'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">Support for JPG, JPEG, PNG and PDF files</p>
            <Button 
              type="button"
              className="text-base h-12"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Select Files
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">
                Selected Files ({files.length})
              </h3>
              {!processing && !isComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiles([]);
                    setResults([]);
                    setCurrentIndex(0);
                    setDuplicatesCount(0);
                  }}
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    results[index]?.status === 'processing' ? 'border-primary bg-primary/10' :
                    results[index]?.status === 'success' ? 'border-profit/40 bg-profit/10' :
                    results[index]?.status === 'duplicate' ? 'border-amber-500 bg-amber-50' :
                    results[index]?.status === 'error' ? 'border-red-500 bg-loss/10' :
                    'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Unknown type'}
                    </p>
                    {results[index]?.status === 'error' && (
                      <p className="text-xs text-loss mt-1">{results[index].error}</p>
                    )}
                    {results[index]?.status === 'duplicate' && (
                      <p className="text-xs text-amber-600 mt-1">Duplicate - skipped</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {results[index]?.status === 'processing' && (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    )}
                    {results[index]?.status === 'success' && (
                      <CheckCircle2 className="w-5 h-5 text-profit" />
                    )}
                    {results[index]?.status === 'duplicate' && (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                    {results[index]?.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-loss" />
                    )}
                    {!processing && results[index]?.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {processing && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Processing {currentIndex + 1} of {files.length}</span>
                  <span className="text-sm font-medium text-slate-900">
                    {Math.round(((currentIndex + 1) / files.length) * 100)}%
                  </span>
                </div>
                <Progress value={((currentIndex + 1) / files.length) * 100} />
              </div>
            )}

            {isComplete && (
              <div className="mt-4 p-4 bg-muted/40 rounded-md border border-border">
                <p className="text-sm font-medium text-slate-900 mb-2">Processing Complete!</p>
                <p className="text-sm text-slate-600">
                  ✓ {successCount} successful
                  {duplicatesCount > 0 && ` • ⚠ ${duplicatesCount} duplicate${duplicatesCount > 1 ? 's' : ''} skipped`}
                  {errorCount > 0 && ` • ✗ ${errorCount} failed`}
                </p>
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            {!processing && !isComplete && (
              <Button
                onClick={processFiles}
                className="flex-1"
                disabled={files.length === 0}
              >
                Process All Receipts
              </Button>
            )}
            {isComplete && (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setFiles([]);
                    setResults([]);
                    setCurrentIndex(0);
                    setDuplicatesCount(0);
                  }}
                >
                  Upload More
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-primary to-primary hover:from-emerald-700 hover:to-emerald-800"
                  onClick={() => navigate(createPageUrl("Dashboard"))}
                >
                  View Dashboard
                </Button>
              </>
            )}
          </div>
        </>
      )}

      <div className="bg-muted/40 border border-border rounded-md p-4">
        <p className="text-sm text-foreground">
          <strong>Note:</strong> Bulk processing may take several minutes. Duplicate receipts (same vendor, amount, and date) will be automatically detected and skipped.
        </p>
      </div>
    </div>
  );
}