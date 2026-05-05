/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import Papa from "papaparse";
import { 
  Users, 
  UserPlus, 
  Shuffle, 
  Sparkles, 
  Copy, 
  Check, 
  LayoutGrid, 
  Settings2,
  AlertCircle,
  ClipboardList,
  Cat,
  Star,
  Ghost,
  Bird,
  Cloud,
  FileUp,
  FileText,
  UploadCloud,
  Download,
  Share2,
  Table,
  Trash2,
  History,
  X
} from "lucide-react";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini for creative group naming
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Group {
  id: string;
  name: string;
  members: string[];
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  groups: Group[];
}

const SAMPLE_NAMES = [
  "小明", "小華", "阿強", "美玲", "志明", 
  "春嬌", "大雄", "胖虎", "小夫", "靜香",
  "蜘蛛人", "蝙蝠俠", "超人", "閃電俠", "神力女超人",
  "黑寡婦", "鋼鐵人", "海王", "索爾", "洛基"
].join("\n");

export default function App() {
  const [inputText, setInputText] = useState("");
  const [groupType, setGroupType] = useState<"count" | "size">("count");
  const [groupValue, setGroupValue] = useState<number>(2);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem("smart_grouper_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history whenever it changes
  useEffect(() => {
    localStorage.setItem("smart_grouper_history", JSON.stringify(history));
  }, [history]);

  const Mascot = Cat;

  const names = inputText
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const handleGenerate = async () => {
    if (names.length === 0) return;
    setIsGenerating(true);
    
    // Artificial delay for animation feel
    await new Promise((resolve) => setTimeout(resolve, 2800));

    const shuffled: string[] = shuffleArray(names);
    let resultGroups: string[][] = [];

    if (groupType === "count") {
      const numGroups = Math.max(1, Math.min(groupValue, names.length));
      resultGroups = Array.from({ length: numGroups }, () => [] as string[]);
      shuffled.forEach((name: string, i: number) => {
        resultGroups[i % numGroups].push(name);
      });
    } else {
      const size = Math.max(1, groupValue);
      for (let i = 0; i < shuffled.length; i += size) {
        resultGroups.push(shuffled.slice(i, i + size) as string[]);
      }
    }

    let groupNames: string[] = resultGroups.map((_, i) => `第 ${i + 1} 組`);

    if (useAI) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `為這 ${resultGroups.length} 個組別生成創意有趣、充滿童心的組名。主題要一致（例如：神奇咒語、太空探險、夢幻森林等）。只需返回 JSON 數組 ["名1", "名2", ...]。`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        });
        const aiNames = JSON.parse(response.text || "[]") as string[];
        if (Array.isArray(aiNames) && aiNames.length >= resultGroups.length) {
          groupNames = aiNames.slice(0, resultGroups.length).map(name => String(name));
        }
      } catch (error) {
        console.error("AI Naming failed:", error);
      }
    }

    const finalGroups: Group[] = resultGroups.map((members, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: groupNames[i],
      members,
    }));

    setGroups(finalGroups);
    setIsGenerating(false);
    setShowExportMenu(false);

    // Save to history
    const newEntry: HistoryEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleString(),
      groups: finalGroups
    };
    setHistory(prev => [newEntry, ...prev].slice(0, 50)); // Keep last 50 entries

    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F97316', '#EC4899', '#FBBF24']
    });
  };

  const exportAsFile = (type: 'txt' | 'csv') => {
    let content = "";
    if (type === 'txt') {
      content = groups.map(g => `${g.name}:\n${g.members.join("\n")}`).join("\n\n");
    } else {
      content = "Group Name,Member\n" + groups.flatMap(g => g.members.map(m => `${g.name},${m}`)).join("\n");
    }

    const blob = new Blob([content], { type: type === 'txt' ? 'text/plain' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-groups-${new Date().getTime()}.${type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const exportToSheets = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/auth/google/url');
      if (!response.ok) throw new Error('無法取得授權連結');
      const { url } = await response.json();
      
      const authWindow = window.open(url, 'google_oauth', 'width=600,height=700');
      if (!authWindow) {
        alert('請允許彈出視窗以連結 Google 帳號。');
      }
    } catch (err) {
      console.error(err);
      alert('準備匯出時發生錯誤。');
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const payload = {
          title: `Smart Groups Export - ${new Date().toLocaleString()}`,
          groups: groups
        };
        
        try {
          const res = await fetch('/api/export/sheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if (res.ok) {
            const { spreadsheetUrl } = await res.json();
            window.open(spreadsheetUrl, '_blank');
          } else {
            alert('匯出至 Google 試算表失敗。');
          }
        } catch (err) {
          console.error(err);
          alert('通訊錯誤。');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [groups]);

  const copyToClipboard = () => {
    const text = groups
      .map((g) => `${g.name}:\n${g.members.join(", ")}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearInputs = () => {
    setInputText("");
    setGroups([]);
  };

  const importSample = () => {
    setInputText(SAMPLE_NAMES);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      Papa.parse(file, {
        complete: (results) => {
          const importedNames = results.data
            .flat()
            .map(val => String(val).trim())
            .filter(val => val !== "" && val !== "undefined");
          
          if (importedNames.length > 0) {
            setInputText(prev => (prev.trim() ? prev + "\n" + importedNames.join("\n") : importedNames.join("\n")));
          }
        },
        header: false,
        skipEmptyLines: true
      });
    } else if (extension === 'txt' || !extension) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setInputText(prev => (prev.trim() ? prev + "\n" + text.trim() : text.trim()));
        }
      };
      reader.readAsText(file);
    } else {
      alert("目前僅支援 .txt 與 .csv 格式的文件唷！");
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#4A3728] font-sans selection:bg-orange-100 overflow-x-hidden relative">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        accept=".txt,.csv"
        className="hidden"
      />
      {/* Background Decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute top-20 right-[15%] text-orange-200"
        >
          <Star size={100} fill="currentColor" />
        </motion.div>
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, delay: 1 }}
          className="absolute bottom-40 left-[10%] text-pink-200"
        >
          <Star size={140} fill="currentColor" />
        </motion.div>
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ 
              y: [0, -10, 0],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ 
              duration: 3 + Math.random() * 2, 
              repeat: Infinity, 
              delay: Math.random() * 2 
            }}
            style={{
              position: 'absolute',
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            className="text-pink-300/30"
          >
            <Cat size={24} />
          </motion.div>
        ))}
      </div>

      {/* Generating Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-orange-500/90 backdrop-blur-xl flex flex-col items-center justify-center text-white"
          >
            <motion.div
              animate={{ 
                y: [0, -40, 0],
                rotate: [-5, 5, -5]
              }}
              transition={{ 
                duration: 0.6, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="mb-8 p-10 bg-white/20 rounded-full"
            >
              <Cat size={160} strokeWidth={1} className="drop-shadow-2xl" />
            </motion.div>
            
            <motion.h2 
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-5xl font-black mb-4 tracking-tight text-center"
            >
              喵嗚！分組魔法中...
            </motion.h2>
            <p className="text-xl font-bold opacity-80 mb-12">貓咪老師正在努力把大家排排站！</p>
            
            <div className="w-80 h-4 bg-white/30 rounded-full overflow-hidden border-2 border-white/20">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.2, ease: "linear" }}
                className="h-full bg-yellow-300"
              />
            </div>
            
            {useAI && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-10 flex items-center gap-3 text-yellow-200 font-black text-lg py-3 px-6 bg-white/10 rounded-full border border-white/10"
              >
                <Sparkles size={24} className="animate-pulse" />
                正在用 AI 幫組別取超級可愛的名字...
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-orange-100 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: 15 }}
              className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-orange-200"
            >
              <Users size={28} />
            </motion.div>
            <div>
              <h1 className="font-black text-2xl tracking-tighter text-orange-950">分組我最厲害</h1>
              <p className="text-xs uppercase tracking-widest font-black text-orange-400">Warm & Joyful Teams</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-8 text-sm font-black text-orange-900/30">
            <span className="hover:text-orange-500 cursor-default transition-all hover:scale-110">COZY</span>
            <span className="hover:text-pink-500 cursor-default transition-all hover:scale-110">WARM</span>
            <span className="hover:text-amber-500 cursor-default transition-all hover:scale-110">HOME</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-12 gap-10">
          
          {/* Left Column: Input & Settings */}
          <div className="lg:col-span-5 space-y-8">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-orange-900/40">
                  <UserPlus size={16} className="text-orange-500" />
                  成員名單 ({names.length})
                </label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 hover:bg-teal-100"
                    title="支援 .txt, .csv 檔案"
                  >
                    <FileUp size={14} /> 匯入文件
                  </button>
                  <button 
                    onClick={importSample}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 hover:bg-orange-100"
                  >
                    <ClipboardList size={14} /> 匯入範例
                  </button>
                  <button 
                    onClick={clearInputs}
                    className="text-xs font-bold text-pink-500 hover:text-pink-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-pink-50"
                  >
                    <Trash2 size={14} /> 清除全部
                  </button>
                </div>
              </div>
              <div 
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className="relative group block"
              >
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="輸入姓名，每行一個...或直接拖入檔案！"
                  className={`w-full h-80 p-8 rounded-[3rem] border-4 bg-white shadow-2xl shadow-orange-100/50 focus:border-orange-400 focus:ring-0 transition-all resize-none font-bold placeholder:text-orange-100 text-xl leading-relaxed ${
                    isDragging ? "border-orange-500 bg-orange-50" : "border-white"
                  }`}
                />
                
                {isDragging && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-orange-600/10 backdrop-blur-[2px] rounded-[3rem] border-4 border-dashed border-orange-500 pointer-events-none"
                  >
                    <div className="bg-orange-600 text-white p-6 rounded-full shadow-2xl mb-4">
                      <UploadCloud size={48} />
                    </div>
                    <p className="font-black text-orange-600 text-xl">放開手，立即匯入！</p>
                  </motion.div>
                )}

                <div className="absolute top-6 right-6 text-orange-100 group-focus-within:text-orange-400 transition-colors">
                  <Cat size={24} />
                </div>
              </div>
              <div className="flex gap-4 px-2">
                <span className="text-[10px] font-bold text-orange-300 uppercase tracking-widest flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-teal-400" />
                  支援格式: .txt, .csv
                </span>
                <span className="text-[10px] font-bold text-orange-300 uppercase tracking-widest flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-teal-400" />
                  可直接拖曳檔案進來
                </span>
              </div>
            </section>

            <section className="space-y-6 bg-white/80 backdrop-blur-sm p-8 rounded-[2.5rem] border-4 border-white shadow-2xl shadow-orange-100/50">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-orange-900/40 mb-2">
                <Settings2 size={16} className="text-orange-500" />
                分組設定
              </div>

              <div className="space-y-5">
                <div className="flex p-1.5 bg-orange-50 rounded-2xl">
                  <button
                    onClick={() => setGroupType("count")}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                      groupType === "count" ? "bg-white shadow-md text-orange-600 scale-[1.02]" : "text-orange-300 hover:text-orange-400"
                    }`}
                  >
                    分成幾組
                  </button>
                  <button
                    onClick={() => setGroupType("size")}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                      groupType === "size" ? "bg-white shadow-md text-pink-600 scale-[1.02]" : "text-orange-300 hover:text-orange-400"
                    }`}
                  >
                    每組幾人
                  </button>
                </div>

                <div className="flex items-center gap-5">
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={groupValue}
                      onChange={(e) => setGroupValue(parseInt(e.target.value) || 1)}
                      className="w-28 p-4 rounded-2xl border-4 border-orange-50 font-black text-2xl text-center text-orange-600 focus:border-orange-400 transition-all bg-white"
                    />
                  </div>
                  <span className="font-bold text-orange-900/40 text-sm leading-tight italic">
                    {groupType === "count" ? "目標總組數" : "每組的目標人數"}
                  </span>
                </div>

                <label className="flex items-center gap-4 p-5 rounded-[1.5rem] border-4 border-orange-50 bg-white hover:border-orange-200 cursor-pointer transition-all group overflow-hidden relative">
                  <input 
                    type="checkbox" 
                    checked={useAI}
                    onChange={(e) => setUseAI(e.target.checked)}
                    className="w-6 h-6 rounded-lg border-2 border-orange-100 text-orange-600 focus:ring-orange-500 transition-all"
                  />
                  <span className="flex-1 text-sm font-bold text-orange-900/70 flex items-center gap-2">
                    <Sparkles size={16} className="text-yellow-500 fill-yellow-200" />
                    AI 生成趣味組名
                  </span>
                  {useAI && (
                    <motion.div 
                      layoutId="sparkle-bg"
                      className="absolute inset-0 bg-yellow-400/5 -z-10"
                    />
                  )}
                </label>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                disabled={names.length === 0 || isGenerating}
                className="w-full py-5 bg-orange-500 text-white rounded-[1.75rem] font-black text-xl flex items-center justify-center gap-3 hover:bg-orange-600 shadow-xl shadow-orange-200 transition-all disabled:bg-orange-100 disabled:shadow-none disabled:cursor-not-allowed group"
              >
                {isGenerating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Shuffle size={24} />
                  </motion.div>
                ) : (
                  <>
                    <Shuffle size={24} className="group-hover:rotate-180 transition-transform duration-500" />
                    開始分組！
                  </>
                )}
              </motion.button>
            </section>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-orange-900/40">
                <LayoutGrid size={20} className="text-orange-500" />
                超酷的分組結果
              </h2>
              {groups.length > 0 && (
                <div className="flex gap-4">
                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="bg-white text-orange-600 border-4 border-orange-50 shadow-2xl shadow-orange-100/50 hover:bg-orange-600 hover:text-white hover:border-orange-600 text-sm font-black uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 transition-all"
                    >
                      <Download size={20} />
                      匯出結果
                    </motion.button>

                    <AnimatePresence>
                      {showExportMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-4 w-64 bg-white border-4 border-orange-50 rounded-[2rem] shadow-2xl overflow-hidden z-[60]"
                        >
                          <div className="p-2 space-y-1">
                            <button
                              onClick={() => exportAsFile('txt')}
                              className="w-full text-left px-6 py-4 hover:bg-orange-50 rounded-2xl flex items-center gap-3 text-orange-900/60 font-bold transition-colors"
                            >
                              <FileText size={18} className="text-orange-500" />
                              匯出為文字檔 (.txt)
                            </button>
                            <button
                              onClick={() => exportAsFile('csv')}
                              className="w-full text-left px-6 py-4 hover:bg-orange-50 rounded-2xl flex items-center gap-3 text-orange-900/60 font-bold transition-colors"
                            >
                              <Table size={18} className="text-orange-500" />
                              匯出為表格 (.csv)
                            </button>
                            <button
                              onClick={exportToSheets}
                              disabled={isExporting}
                              className="w-full text-left px-6 py-4 hover:bg-orange-50 rounded-2xl flex items-center gap-3 text-orange-900/60 font-bold transition-colors border-t border-orange-50"
                            >
                              <Share2 size={18} className="text-blue-500" />
                              匯出至 Google 試算表
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={copyToClipboard}
                    className={`text-sm font-black uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 transition-all ${
                      copied 
                      ? "bg-amber-500 text-white shadow-2xl shadow-amber-200" 
                      : "bg-white text-orange-600 border-4 border-orange-50 shadow-2xl shadow-orange-100/50 hover:bg-orange-600 hover:text-white hover:border-orange-600"
                    }`}
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                    {copied ? "複製成功！" : "複製結果"}
                  </motion.button>
                </div>
              )}
            </div>

            <div className="min-h-[500px] relative">
              <AnimatePresence mode="popLayout">
                {groups.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-orange-200 text-center space-y-6"
                  >
                    <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-orange-100/50 rotate-12 border-4 border-white">
                      <Cat size={64} />
                    </div>
                    <div>
                      <p className="font-black text-2xl text-orange-900/20">準備好要分組了嗎？</p>
                      <p className="text-sm font-bold text-orange-300">左邊輸入小夥伴的名單吧！</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    layout
                    className="grid sm:grid-cols-2 gap-8"
                  >
                    {groups.map((group, idx) => (
                      <motion.div
                        key={group.id}
                        initial={{ opacity: 0, y: 30, rotate: idx % 2 === 0 ? -1 : 1 }}
                        animate={{ opacity: 1, y: 0, rotate: 0 }}
                        transition={{ 
                          type: "spring",
                          damping: 12,
                          stiffness: 100,
                          delay: idx * 0.08 
                        }}
                        className="bg-white border-4 border-white rounded-[2rem] p-8 shadow-xl shadow-orange-100/50 hover:shadow-2xl hover:scale-[1.02] transition-all group/card overflow-hidden relative"
                      >
                        {/* Group accent bar */}
                        <div className={`absolute top-0 left-0 right-0 h-2 ${
                          ['bg-orange-500', 'bg-pink-500', 'bg-amber-500', 'bg-yellow-500', 'bg-teal-500'][idx % 5]
                        }`} />
                        
                        <div className="flex justify-between items-start mb-6">
                          <h3 className="font-black text-xl text-orange-950 leading-tight">
                            {group.name}
                          </h3>
                          <span className="px-3 py-1 bg-orange-50 rounded-full text-[11px] font-black uppercase text-orange-400">
                            {group.members.length} 人
                          </span>
                        </div>
                        <ul className="space-y-3">
                          {group.members.map((member, mIdx) => (
                            <motion.li 
                              key={mIdx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 + mIdx * 0.05 }}
                              className="text-base font-bold text-orange-900/60 flex items-center gap-3"
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                ['bg-orange-200', 'bg-pink-200', 'bg-amber-200', 'bg-yellow-200', 'bg-teal-200'][idx % 5]
                              }`} />
                              {member}
                            </motion.li>
                          ))}
                        </ul>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Hint */}
            {names.length > 0 && names.length < 2 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10 flex items-center gap-3 p-5 bg-pink-50 border-2 border-pink-100 rounded-[1.5rem] text-pink-700 text-sm font-bold"
              >
                <AlertCircle size={20} />
                哎呀！至少需要兩個人才能分組喔，再多加一點夥伴吧！
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Floating History Button & Panel */}
      <AnimatePresence>
        <div className="fixed bottom-8 right-8 z-[80] flex flex-col items-end gap-4">
          {/* History Panel */}
          {isHistoryOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20, originX: 1, originY: 1 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-[380px] max-w-[90vw] max-h-[70vh] bg-white border-4 border-orange-50 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(251,146,60,0.2)] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-orange-50 flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-xl font-black text-orange-950 flex items-center gap-2">
                  <History className="text-orange-500" size={24} />
                  分組歷程
                </h2>
                <div className="flex gap-2">
                  {history.length > 0 && (
                    <button 
                      onClick={() => {
                        if(confirm("確定要清空所有歷程嗎？貓咪會傷心喔！")) setHistory([]);
                      }}
                      className="p-2 hover:bg-red-50 rounded-full text-red-400 transition-colors"
                      title="清空歷程"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsHistoryOpen(false)}
                    className="p-2 hover:bg-orange-50 rounded-full text-orange-400 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {history.length === 0 ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto text-orange-200">
                      <History size={32} />
                    </div>
                    <p className="font-bold text-orange-300">目前還沒有分組記錄唷！</p>
                  </div>
                ) : (
                  history.map((entry) => (
                    <motion.div
                      key={entry.id}
                      layout
                      className="bg-orange-50/50 border-2 border-orange-50 rounded-2xl p-4 hover:bg-white hover:border-orange-100 transition-all group/hist-item"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest">{entry.timestamp}</span>
                        <div className="flex gap-1 opacity-0 group-hover/hist-item:opacity-100 transition-opacity">
                          <button 
                             onClick={() => { setGroups(entry.groups); setIsHistoryOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                             className="p-1 px-2 bg-white text-orange-600 rounded-lg text-[10px] font-black hover:bg-orange-600 hover:text-white transition-all"
                          >
                            恢復
                          </button>
                          <button 
                            onClick={() => setHistory(prev => prev.filter(h => h.id !== entry.id))}
                            className="p-1 hover:bg-red-50 rounded-full text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.groups.map((g, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 bg-white border border-orange-100 rounded-md text-orange-700 font-bold">
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* Clock FAB */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-2xl transition-all ${
              isHistoryOpen ? "bg-orange-600 text-white" : "bg-white text-orange-600 border-4 border-orange-50 group"
            }`}
          >
            {isHistoryOpen ? <X size={32} /> : <History size={32} className="group-hover:rotate-[-20deg] transition-transform" />}
            {history.length > 0 && !isHistoryOpen && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-pink-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce border-2 border-white">
                {history.length}
              </span>
            )}
          </motion.button>
        </div>
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-20 border-t border-orange-100 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-10">
            <Cat className="text-orange-200" size={32} />
            <Shuffle className="text-orange-200" size={32} />
            <Sparkles className="text-orange-200" size={32} />
          </div>
          <p className="text-sm font-black text-orange-900/10 tracking-[0.3em] uppercase">
            Warm Hearts, Happy Teams
          </p>
        </div>
      </footer>
    </div>
  );
}
