import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Image, Images } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import SingleUpload from "../components/upload/SingleUpload";
import { AlertTriangle } from "lucide-react";

export default function Upload() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("single");

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="rounded-xl border-slate-300 flex-shrink-0 h-10 w-10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Upload Receipts
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">AI-powered receipt scanning and data extraction</p>
          </div>
        </div>

        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-slate-200 px-4 sm:px-6 pt-4 sm:pt-6">
              <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100">
                <TabsTrigger value="single" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-white">
                  <Image className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Single Receipt</span>
                  <span className="sm:hidden">Single</span>
                </TabsTrigger>
                <TabsTrigger value="bulk" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-white">
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
              <div className="text-center py-8 sm:py-12">
                <AlertTriangle className="w-12 sm:w-16 h-12 sm:h-16 mx-auto text-yellow-500 mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold text-slate-700 mb-2">Funkcjonalność tymczasowo niedostępna</h3>
                <p className="text-sm sm:text-base text-slate-600">Przesyłanie masowe plików zostało wyłączone.</p>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}