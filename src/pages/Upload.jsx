import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Image, Images } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import QuoteLine from "@/components/QuoteLine";

import SingleUpload from "../components/upload/SingleUpload";
import BulkUpload from "../components/upload/BulkUpload";

export default function Upload() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("single");

  return (
    <div className="w-full min-h-0 space-y-6 dashboard-surface">
      <div className="max-w-none mx-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="rounded-xl cyber-btn-outline flex-shrink-0 h-10 w-10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="cyber-page-title text-2xl sm:text-3xl md:text-4xl">
              Upload Receipts
            </h1>
            <p className="cyber-page-sub text-sm sm:text-base mt-1">AI-powered receipt scanning and data extraction</p>
          </div>
          <QuoteLine className="hidden lg:flex shrink-0" />
        </div>

        <Card className="bg-card border-border">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-border px-4 sm:px-6 pt-4 sm:pt-6">
              <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted">
                <TabsTrigger value="single" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-background">
                  <Image className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Single Receipt</span>
                  <span className="sm:hidden">Single</span>
                </TabsTrigger>
                <TabsTrigger value="bulk" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-background">
                  <Images className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Bulk Upload</span>
                  <span className="sm:hidden">Bulk</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="single" className="p-4 sm:p-6">
              <SingleUpload />
            </TabsContent>

            <TabsContent value="bulk" className="p-4 sm:p-6">
              <BulkUpload />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}