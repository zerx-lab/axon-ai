// 应用更新检查 Hook

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface UpdateInfo {
  available: boolean;
  current_version: string;
  new_version?: string;
  update_notes?: string;
  download_progress: number;
}

interface UseAppUpdaterState {
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  isInstalling: boolean;
  error: string | null;
}

export const useAppUpdater = () => {
  const [state, setState] = useState<UseAppUpdaterState>({
    updateInfo: null,
    isChecking: false,
    isInstalling: false,
    error: null,
  });

  // 检查更新
  const checkUpdate = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true, error: null }));
    try {
      const info = await invoke<UpdateInfo>('check_app_update');
      setState(prev => ({
        ...prev,
        updateInfo: info,
        isChecking: false,
      }));
      return info;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setState(prev => ({
        ...prev,
        isChecking: false,
        error,
      }));
      console.error('检查更新失败:', error);
      return null;
    }
  }, []);

  // 安装更新
  const installUpdate = useCallback(async () => {
    if (!state.updateInfo?.available) {
      console.warn('没有可用的更新');
      return false;
    }

    setState(prev => ({ ...prev, isInstalling: true, error: null }));
    try {
      await invoke<void>('install_app_update');
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setState(prev => ({
        ...prev,
        isInstalling: false,
        error,
      }));
      console.error('安装更新失败:', error);
      return false;
    }
  }, [state.updateInfo]);

  // 获取当前版本
  const getCurrentVersion = useCallback(async () => {
    try {
      const version = await invoke<string>('get_app_version');
      return version;
    } catch (err) {
      console.error('获取版本失败:', err);
      return null;
    }
  }, []);

  // 取消更新
  const cancelUpdate = useCallback(() => {
    setState(prev => ({
      ...prev,
      updateInfo: null,
      error: null,
    }));
  }, []);

  // 自动检查更新（可选）
  const startAutoCheck = useCallback((intervalMs = 60 * 60 * 1000) => {
    checkUpdate();

    const interval = setInterval(() => {
      checkUpdate();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [checkUpdate]);

  return {
    ...state,
    checkUpdate,
    installUpdate,
    cancelUpdate,
    getCurrentVersion,
    startAutoCheck,
  };
};
