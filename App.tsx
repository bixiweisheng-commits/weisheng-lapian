import React, { useState, useRef, useEffect } from 'react';
import { Upload, Film, Settings, Download, Plus, Video as VideoIcon, Image as ImageIcon, Save, FolderOpen, Play, Square, AlertCircle, ScanEye } from 'lucide-react';
import ShotCard from './components/ShotCard';
import ChatBot from './components/ChatBot';
import ApiKeyModal from './components/ApiKeyModal';
import { Shot, ImageResolution } from './types';
import { analyzeShotFrame, generateImageFromPrompt, editImageWithPrompt } from './services/geminiService';
import { exportToWord, exportToExcel, printForPdf } from './services/exportService';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || '');
  const [showKeyModal, setShowKeyModal] = useState(!process.env.API_KEY);
  
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // Auto Extract State
  const [isAutoExtracting, setIsAutoExtracting] = useState(false);
  const [threshold, setThreshold] = useState(25); // Visual difference threshold (1-100)
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Generation Modal State
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [activeEditShotId, setActiveEditShotId] = useState<string | null>(null);

  // Force Login Check on Mount
  useEffect(() => {
    if (!apiKey) {
      setShowKeyModal(true);
    }
  }, [apiKey]);

  // --- File Handling ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setShots([]);
    }
  };

  // --- Save / Load Project ---
  const saveProject = () => {
    const projectData = {
      version: '1.1',
      appName: 'HuanXiAI',
      timestamp: Date.now(),
      shots: shots
    };
    const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HuanXiAI_Project_${new Date().toISOString().slice(0,10)}.cinetrace`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.shots && Array.isArray(data.shots)) {
          setShots(data.shots);
          alert(`成功加载 ${data.shots.length} 个镜头`);
        } else {
          alert("无效的项目文件");
        }
      } catch (error) {
        alert("文件解析错误");
      }
    };
    reader.readAsText(file);
  };

  // --- Frame Capture & Analysis Helper ---
  const processFrame = async (video: HTMLVideoElement, time: number, shotNum: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);
    const newId = crypto.randomUUID();

    const newShot: Shot = {
      id: newId,
      timestamp: time,
      imageUrl: base64Image,
      analysis: null,
      isAnalyzing: true
    };

    setShots(prev => [...prev, newShot]);

    // Analyze async
    analyzeShotFrame(apiKey, base64Image.split(',')[1], shotNum)
      .then(analysisData => {
        setShots(current => current.map(s => 
          s.id === newId ? { ...s, isAnalyzing: false, analysis: analysisData, error: undefined } : s
        ));
      })
      .catch(err => {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setShots(current => current.map(s => 
          s.id === newId ? { ...s, isAnalyzing: false, error: errorMessage } : s
        ));
        console.error("Analysis Error", err);
      });
  };

  // --- Smart Scene Detection Logic ---
  const getImageData = (video: HTMLVideoElement): Uint8ClampedArray | null => {
    const canvas = document.createElement('canvas');
    // Downscale for performance
    canvas.width = 100; 
    canvas.height = 100 * (video.videoHeight / video.videoWidth);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  };

  const getPixelDiff = (data1: Uint8ClampedArray, data2: Uint8ClampedArray) => {
    let diff = 0;
    for (let i = 0; i < data1.length; i += 4) {
      // Compare RGB channels
      diff += Math.abs(data1[i] - data2[i]);
      diff += Math.abs(data1[i + 1] - data2[i + 1]);
      diff += Math.abs(data1[i + 2] - data2[i + 2]);
    }
    // Average difference per pixel
    return diff / (data1.length / 4 * 3);
  };

  const startAutoExtract = async () => {
    if (!videoRef.current || !apiKey) {
      if (!apiKey) setShowKeyModal(true);
      return;
    }
    const video = videoRef.current;
    
    setIsAutoExtracting(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const duration = video.duration;
    let currentTime = 0;
    const scanStep = 0.5; // Scan every 0.5 seconds to detect cut
    
    let lastCapturedData: Uint8ClampedArray | null = null;
    let shotCount = shots.length + 1;

    try {
      // 1. Always capture the first frame
      video.currentTime = 0;
      await new Promise(r => setTimeout(r, 300)); // Wait for seek render
      await processFrame(video, 0, shotCount++);
      lastCapturedData = getImageData(video);

      currentTime += scanStep;

      while (currentTime < duration) {
        if (signal.aborted) break;

        // Seek
        video.currentTime = currentTime;
        await new Promise<void>(resolve => {
           const handler = () => { video.removeEventListener('seeked', handler); resolve(); };
           video.addEventListener('seeked', handler);
        });
        
        // Wait for frame to render clearly
        await new Promise(r => setTimeout(r, 100));

        // Smart Detection
        const currentData = getImageData(video);
        if (currentData && lastCapturedData) {
          const diff = getPixelDiff(lastCapturedData, currentData);
          
          // Log logic: If difference > threshold, it's a new shot
          // A standard cut is usually > 30-40 difference in average pixel value
          if (diff > threshold) {
             console.log(`Cut detected at ${currentTime.toFixed(2)}s (Diff: ${diff.toFixed(2)})`);
             await processFrame(video, currentTime, shotCount++);
             lastCapturedData = currentData; // Update reference frame
             
             // Skip ahead a bit more to avoid capturing transition frames if any
             currentTime += 1.0; 
          }
        } else if (!lastCapturedData && currentData) {
           lastCapturedData = currentData;
        }

        currentTime += scanStep;
      }
    } catch (e) {
      console.error("Auto extract interrupted", e);
    } finally {
      setIsAutoExtracting(false);
    }
  };

  const stopAutoExtract = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAutoExtracting(false);
  };


  // --- Actions ---
  const handleDeleteShot = (id: string) => {
    setShots(prev => prev.filter(s => s.id !== id));
  };

  const captureAndAnalyze = async () => {
      if (!videoRef.current) return;
      await processFrame(videoRef.current, videoRef.current.currentTime, shots.length + 1);
  };

  const handleRetryAnalysis = async (id: string) => {
    const shot = shots.find(s => s.id === id);
    if (!shot || !apiKey) {
        if (!apiKey) setShowKeyModal(true);
        return;
    }

    // Set to analyzing
    setShots(prev => prev.map(s => s.id === id ? { ...s, isAnalyzing: true, error: undefined } : s));

    try {
        // We use the shot index in the array as a proxy for shot number if analysis is missing
        const index = shots.findIndex(s => s.id === id);
        const shotNum = shot.analysis?.shotNumber || (index + 1);
        
        const analysisData = await analyzeShotFrame(apiKey, shot.imageUrl.split(',')[1], shotNum);
        
        setShots(prev => prev.map(s => 
            s.id === id ? { ...s, isAnalyzing: false, analysis: analysisData, error: undefined } : s
        ));
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Retry failed";
        setShots(prev => prev.map(s => 
            s.id === id ? { ...s, isAnalyzing: false, error: errorMessage } : s
        ));
    }
  };

  const handleDownloadImage = (id: string) => {
    const shot = shots.find(s => s.id === id);
    if (!shot) return;

    const link = document.createElement('a');
    link.href = shot.imageUrl;
    const shotNum = shot.analysis?.shotNumber || 'shot';
    link.download = `HuanXiAI_Shot_${shotNum}_${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateImage = async (prompt: string, resolution: ImageResolution) => {
    if (!apiKey) return setShowKeyModal(true);
    setIsGenerating(true);
    setGeneratedImage(null);
    try {
      const imgUrl = await generateImageFromPrompt(apiKey, prompt, resolution);
      setGeneratedImage(imgUrl);
    } catch (e) {
      alert("Image Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditImage = (shotId: string, imageBase64: string) => {
    setActiveEditShotId(shotId);
    setGeneratedImage(imageBase64); // reuse modal for preview
    setEditPrompt(""); 
  };

  const executeImageEdit = async () => {
    if (!activeEditShotId || !editPrompt || !apiKey) return;
    setIsGenerating(true);
    const shot = shots.find(s => s.id === activeEditShotId);
    if (!shot) return;

    try {
        const resultUrl = await editImageWithPrompt(apiKey, shot.imageUrl, editPrompt);
        setGeneratedImage(resultUrl);
    } catch (e) {
        alert("Edit failed");
    } finally {
        setIsGenerating(false);
    }
  };

  // --- Strict Auth Gate ---
  if (!apiKey && !showKeyModal) {
    // Should generally be caught by useEffect, but for safety:
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-30 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <Film className="text-emerald-500 w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-tight">欢玺AI <span className="text-gray-500 text-sm font-normal">智能拉片系统</span></h1>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex gap-2 mr-2">
              <input ref={projectInputRef} type="file" accept=".cinetrace" className="hidden" onChange={loadProject} />
              <button onClick={() => projectInputRef.current?.click()} className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1.5 rounded flex items-center gap-2 transition text-gray-300">
                 <FolderOpen size={16} /> 导入
               </button>
               <button onClick={saveProject} disabled={shots.length === 0} className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1.5 rounded flex items-center gap-2 transition text-gray-300 disabled:opacity-50">
                 <Save size={16} /> 保存
               </button>
           </div>

           {shots.length > 0 && (
             <div className="flex gap-2 mr-4 border-l border-gray-700 pl-4">
               <button onClick={() => exportToWord(shots, "Video Analysis")} className="text-sm bg-emerald-900/50 hover:bg-emerald-800 border border-emerald-700 px-3 py-1.5 rounded flex items-center gap-2 transition text-emerald-100">
                 <Download size={16} /> 导出 Word
               </button>
               <button onClick={() => exportToExcel(shots, "Video Analysis")} className="text-sm bg-emerald-900/50 hover:bg-emerald-800 border border-emerald-700 px-3 py-1.5 rounded flex items-center gap-2 transition text-emerald-100">
                 <Download size={16} /> 导出 Excel
               </button>
             </div>
           )}
           <button 
             onClick={() => setShowKeyModal(true)}
             className="p-2 rounded-full hover:bg-gray-800 transition"
             title="Settings"
           >
             <Settings className="w-5 h-5 text-gray-400" />
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Player & Controls */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 sticky top-24 h-fit">
            <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
              {videoSrc ? (
                <div className="relative group">
                  <video 
                    ref={videoRef} 
                    src={videoSrc} 
                    controls 
                    className="w-full aspect-video bg-black"
                  />
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video bg-gray-800 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-750 transition border-2 border-dashed border-gray-700 hover:border-emerald-500 group"
                >
                  <Upload className="w-12 h-12 text-gray-600 group-hover:text-emerald-500 mb-2 transition" />
                  <span className="text-gray-500 font-medium">点击上传视频</span>
                  <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                </div>
              )}
              
              <div className="p-4 bg-gray-850">
                <div className="flex justify-between items-center mb-4">
                   <div>
                      <h3 className="text-sm font-semibold text-gray-300">播放与采集</h3>
                      <p className="text-xs text-gray-500">{videoSrc ? "视频已加载" : "请先上传视频"}</p>
                   </div>
                   <button 
                     onClick={captureAndAnalyze}
                     disabled={!videoSrc || isAutoExtracting}
                     className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-1.5 text-sm rounded-lg font-medium flex items-center gap-2 transition"
                   >
                     <Plus className="w-4 h-4" /> 单帧抓取
                   </button>
                </div>

                {/* Smart Auto Extract Controls */}
                <div className="border-t border-gray-700 pt-4 bg-gray-900/50 -mx-4 px-4 pb-2">
                  <div className="flex items-center gap-2 mb-2">
                     <ScanEye size={16} className="text-emerald-400" />
                     <h4 className="text-sm font-bold text-white">智能自动拉片</h4>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    通过视觉差算法自动识别镜头切换，避免重复画面。
                  </p>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">灵敏度阈值 ({threshold})</label>
                      <input 
                        type="range" 
                        min="10" 
                        max="60"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        disabled={isAutoExtracting}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        title="Lower = More Sensitive (More Shots), Higher = Less Sensitive"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                        <span>更敏感 (更多镜头)</span>
                        <span>更迟钝 (忽略微小变化)</span>
                      </div>
                    </div>
                    
                    {isAutoExtracting ? (
                      <button 
                        onClick={stopAutoExtract}
                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-medium flex items-center gap-2 h-10"
                      >
                         <Square size={16} /> 停止
                      </button>
                    ) : (
                       <button 
                        onClick={startAutoExtract}
                        disabled={!videoSrc}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded font-medium flex items-center gap-2 h-10 shadow-lg shadow-emerald-900/50"
                      >
                         <Play size={16} /> 开始分析
                      </button>
                    )}
                  </div>
                  {isAutoExtracting && (
                     <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 p-2 rounded">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        正在扫描视频切片，请勿切换页面...
                     </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 text-sm text-gray-400">
               <h4 className="font-bold text-gray-300 mb-2 flex items-center gap-2"><AlertCircle size={14}/> 操作指南</h4>
               <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed">
                 <li>首次使用必须输入 <strong>Gemini API Key</strong>。</li>
                 <li><strong>智能自动拉片</strong>: 点击"开始分析"，AI会自动遍历视频，识别镜头切换点并抓取分析。</li>
                 <li>如果发现镜头抓取过多（太敏感）或过少（漏抓），请调整<strong>灵敏度阈值</strong>。</li>
                 <li>所有数据可导出为专业的 Word 或 Excel 拉片表格。</li>
               </ul>
            </div>
          </div>

          {/* Right Column: Shot List */}
          <div className="lg:col-span-7 xl:col-span-8">
            <div className="flex items-center gap-3 mb-6">
              <VideoIcon className="text-gray-500" />
              <h2 className="text-2xl font-bold">拉片列表 <span className="text-emerald-500 text-lg">({shots.length} 镜头)</span></h2>
            </div>
            
            <div className="space-y-6">
              {shots.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
                  <Film className="w-16 h-16 text-gray-800 mx-auto mb-4" />
                  <p className="text-gray-600">暂无数据，请上传视频并开始智能分析。</p>
                </div>
              ) : (
                shots.map(shot => (
                  <ShotCard 
                    key={shot.id} 
                    shot={shot} 
                    onDelete={handleDeleteShot} 
                    onGenerateImage={handleGenerateImage}
                    onEditImage={handleEditImage}
                    onRetry={handleRetryAnalysis}
                    onDownloadImage={handleDownloadImage}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <ChatBot apiKey={apiKey} />
      
      {showKeyModal && (
        <ApiKeyModal 
          initialKey={apiKey}
          onSave={(key) => {
            setApiKey(key);
            setShowKeyModal(false);
          }}
          onClose={() => {
             if (apiKey) setShowKeyModal(false);
             else alert("必须输入API Key才能使用系统");
          }}
        />
      )}

      {/* Image Generation/Edit Modal */}
      {(generatedImage || isGenerating || activeEditShotId) && !showKeyModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
           <div className="bg-gray-900 rounded-xl max-w-4xl w-full border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                <h3 className="font-bold flex items-center gap-2">
                  <ImageIcon size={18} className="text-purple-400" /> 
                  {activeEditShotId ? 'AI 修图 (Gemini)' : 'AI 生图 (Gemini)'}
                </h3>
                <button onClick={() => { setGeneratedImage(null); setActiveEditShotId(null); }}><div className="text-gray-400 hover:text-white">✕</div></button>
              </div>
              
              <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center bg-black/50">
                 {isGenerating ? (
                   <div className="text-center">
                     <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                     <p className="text-emerald-400 animate-pulse">AI 正在创意生成中...</p>
                   </div>
                 ) : (
                    generatedImage && <img src={generatedImage} className="max-w-full max-h-[60vh] rounded shadow-lg border border-gray-800" alt="Generated" />
                 )}
              </div>

              {/* Edit Controls */}
              {activeEditShotId && !isGenerating && (
                <div className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2">
                  <input 
                    className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                    placeholder="请输入修改指令 (例如: '变成赛博朋克风格', '把白天改成黑夜')"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                  />
                  <button 
                    onClick={executeImageEdit}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium"
                  >
                    确认修改
                  </button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default App;