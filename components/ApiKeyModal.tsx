import React, { useState } from 'react';
import { Key } from 'lucide-react';

interface Props {
  onSave: (key: string) => void;
  onClose: () => void;
  initialKey: string;
}

const ApiKeyModal: React.FC<Props> = ({ onSave, onClose, initialKey }) => {
  const [key, setKey] = useState(initialKey);
  // If there is no initial key (first login), user cannot cancel.
  const canCancel = !!initialKey;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-2 mb-4 text-emerald-400">
          <Key className="w-6 h-6" />
          <h2 className="text-xl font-bold text-white">欢玺AI - 登录设置</h2>
        </div>
        
        <p className="text-gray-400 mb-4 text-sm">
          欢迎使用欢玺AI智能拉片系统。请在下方输入您的 Google Gemini API Key 以开始使用。
        </p>

        <label className="block text-xs font-uppercase text-gray-500 mb-1">API KEY</label>
        <input 
          type="password" 
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIzaSy..."
          className="w-full bg-gray-900 border border-gray-700 text-white rounded p-3 mb-6 focus:ring-2 focus:ring-emerald-500 outline-none"
        />

        <div className="flex justify-end gap-3">
          {canCancel && (
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded text-gray-300 hover:text-white"
            >
              取消
            </button>
          )}
          <button 
            onClick={() => onSave(key)}
            disabled={!key}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium shadow-lg shadow-emerald-900/50"
          >
            {canCancel ? '保存' : '进入系统'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;