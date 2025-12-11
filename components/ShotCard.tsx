import React, { useState } from 'react';
import { Trash2, Wand2, RefreshCw, PenTool, Image as ImageIcon, Film, Mic, Video, Users, Copy, Check } from 'lucide-react';
import { Shot, ImageResolution } from '../types';

interface Props {
  shot: Shot;
  onDelete: (id: string) => void;
  onGenerateImage: (prompt: string, resolution: ImageResolution) => void;
  onEditImage: (id: string, imageBase64: string) => void;
}

const ShotCard: React.FC<Props> = ({ shot, onDelete, onGenerateImage, onEditImage }) => {
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_1K);
  const [copied, setCopied] = useState(false);

  const formatTime = (seconds: number) => {
    return new Date(seconds * 1000).toISOString().substr(14, 5);
  };

  const handleCopyPrompt = () => {
    if (shot.analysis?.mjPrompt) {
      navigator.clipboard.writeText(shot.analysis.mjPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col shadow-lg transition-all hover:border-gray-600 break-inside-avoid mb-6">
      <div className="flex flex-col md:flex-row">
        {/* Image Section - Left */}
        <div className="md:w-1/3 relative group bg-black flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-700">
          <img src={shot.imageUrl} alt={`Shot ${shot.analysis?.shotNumber}`} className="max-h-80 object-contain w-full" />
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-mono border border-gray-600">
            {formatTime(shot.timestamp)}
          </div>
          
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
             <button 
              onClick={() => onEditImage(shot.id, shot.imageUrl)}
              className="p-3 bg-blue-600 rounded-full hover:bg-blue-500 text-white shadow-lg"
              title="AI 编辑图片"
            >
              <PenTool size={20} />
            </button>
          </div>
        </div>

        {/* Data Section - Right */}
        <div className="p-4 md:w-2/3 flex flex-col justify-between">
          {shot.isAnalyzing ? (
            <div className="flex items-center gap-3 text-emerald-400 animate-pulse h-full justify-center">
              <RefreshCw className="animate-spin w-6 h-6" /> 
              <span className="text-lg">AI 正在深度分析画面...</span>
            </div>
          ) : shot.analysis ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-gray-700 pb-2">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="bg-emerald-600 text-xs px-2 py-0.5 rounded text-white">#{shot.analysis.shotNumber}</span>
                    <span className="text-gray-300 text-sm font-normal">时长: {shot.analysis.duration || '-'}</span>
                  </h3>
                </div>
                <div className="flex gap-2 text-xs">
                   <span className="bg-gray-700 px-2 py-1 rounded text-gray-300">{shot.analysis.environment?.shotSize}</span>
                   <span className="bg-gray-700 px-2 py-1 rounded text-gray-300">{shot.analysis.camera?.angle}</span>
                </div>
              </div>
              
              {/* Analysis Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                
                {/* Visual Content */}
                <div className="col-span-2">
                  <p className="text-gray-400 text-xs uppercase flex items-center gap-1 mb-1"><Film size={12}/> 镜头内容 (Visual & Subtext)</p>
                  <p className="text-gray-200">{shot.analysis.content?.visual}</p>
                  <p className="text-gray-400 text-xs mt-1 italic">"{shot.analysis.content?.subtext}"</p>
                </div>

                {/* Technical Details */}
                <div>
                  <p className="text-gray-400 text-xs uppercase flex items-center gap-1 mb-1"><Video size={12}/> 相机与环境</p>
                  <ul className="text-gray-300 space-y-0.5 text-xs">
                    <li><span className="text-gray-500">机位:</span> {shot.analysis.camera?.position}</li>
                    <li><span className="text-gray-500">灯光:</span> {shot.analysis.environment?.lighting}</li>
                    <li><span className="text-gray-500">虚实:</span> {shot.analysis.camera?.focus}</li>
                  </ul>
                </div>

                {/* Character & Action */}
                <div>
                  <p className="text-gray-400 text-xs uppercase flex items-center gap-1 mb-1"><Users size={12}/> 人物与调度</p>
                  <p className="text-gray-300 text-xs leading-relaxed">{shot.analysis.character?.blocking}</p>
                  <p className="text-gray-300 text-xs mt-1"><span className="text-gray-500">关系:</span> {shot.analysis.character?.relationships}</p>
                </div>
                
                {/* Audio */}
                <div className="col-span-2 bg-gray-900/40 p-2 rounded">
                  <p className="text-gray-400 text-xs uppercase flex items-center gap-1 mb-1"><Mic size={12}/> 声音设计</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-300">
                    <div><span className="text-gray-500 block">台词</span>{shot.analysis.sound?.dialogue || '-'}</div>
                    <div><span className="text-gray-500 block">音效</span>{shot.analysis.sound?.sfx || '-'}</div>
                    <div><span className="text-gray-500 block">音乐</span>{shot.analysis.sound?.music || '-'}</div>
                  </div>
                </div>

              </div>

              {/* Prompt Section */}
              <div className="bg-gray-900/80 p-3 rounded border border-gray-700/50">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-purple-400 text-xs uppercase font-bold flex items-center gap-1">
                    <Wand2 size={12} /> MJ Prompt
                  </p>
                  <div className="flex items-center gap-1">
                     <button 
                       onClick={handleCopyPrompt}
                       className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded flex items-center gap-1 transition-colors mr-2"
                       title="Copy Prompt"
                     >
                       {copied ? <Check size={12} className="text-emerald-500"/> : <Copy size={12} />}
                     </button>
                     <select 
                       value={resolution} 
                       onChange={(e) => setResolution(e.target.value as ImageResolution)}
                       className="bg-gray-800 text-xs text-white border border-gray-600 rounded px-1"
                     >
                       <option value="1K">1K</option>
                       <option value="2K">2K</option>
                       <option value="4K">4K</option>
                     </select>
                     <button 
                       onClick={() => onGenerateImage(shot.analysis!.mjPrompt, resolution)}
                       className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
                     >
                       <ImageIcon size={10} /> 生成
                     </button>
                  </div>
                </div>
                <p className="text-gray-300 text-xs italic selection:bg-purple-900 line-clamp-3 hover:line-clamp-none cursor-help" title={shot.analysis.mjPrompt}>
                  {shot.analysis.mjPrompt}
                </p>
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-700/50">
                <button 
                  onClick={() => onDelete(shot.id)}
                  className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-red-900/20"
                >
                  <Trash2 size={14} /> 删除镜头
                </button>
              </div>
            </div>
          ) : (
            <div className="text-red-400 text-center py-10">
              分析失败
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShotCard;