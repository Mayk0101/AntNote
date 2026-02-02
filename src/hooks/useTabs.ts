import { useState } from 'react';

export interface FileTab {
    id: string;
    name: string;
    path: string;
    content: string;
    isDirty: boolean;
    language?: string;
}

export const useTabs = () => {
    const [tabs, setTabs] = useState<FileTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('');

    const activeTab = tabs.find(t => t.id === activeTabId);

    const updateTabContent = (id: string, content: string) => {
        setTabs(prev => prev.map(tab =>
            tab.id === id ? { ...tab, content, isDirty: true } : tab
        ));
    };

    const openFile = async () => {
        console.log('Open file triggered');
    };

    const saveFile = async () => {
        if (!activeTab) return;

        let targetPath = activeTab.path;

        if (!targetPath) {
            const result = await window.electronAPI.saveFileDialog(activeTab.name);

            if (result.canceled || !result.filePath) return;
            targetPath = result.filePath;

            const fileName = targetPath.split(/[\\/]/).pop() || activeTab.name;
            setTabs(prev => prev.map(tab =>
                tab.id === activeTabId ? { ...tab, path: targetPath, name: fileName } : tab
            ));
        }

        await window.electronAPI.writeFile(targetPath, activeTab.content);
        setTabs(prev => prev.map(tab =>
            tab.id === activeTabId ? { ...tab, isDirty: false } : tab
        ));
    };

    const renameTabFile = async (id: string, newName: string) => {
        const tab = tabs.find(t => t.id === id);
        if (!tab || !tab.path) return;



        let dirPath = tab.path.substring(0, tab.path.length - tab.name.length);
        const newPath = dirPath + newName;

        const result = await window.electronAPI.renameFile(tab.path, newPath);
        if (result.success) {
            setTabs(prev => prev.map(t =>
                t.id === id ? { ...t, name: newName, path: newPath } : t
            ));
        } else {
            console.error('Rename failed:', result.error);
        }
    };
    const closeTab = (id: string) => {
        const tabIndex = tabs.findIndex(t => t.id === id);
        setTabs(prev => prev.filter(t => t.id !== id));

        if (activeTabId === id && tabs.length > 1) {
            const newIndex = tabIndex > 0 ? tabIndex - 1 : 0;
            const newTabs = tabs.filter(t => t.id !== id);
            if (newTabs.length > 0) {
                setActiveTabId(newTabs[newIndex]?.id || '');
            } else {
                setActiveTabId('');
            }
        }
    };

    const deleteTabFile = async (id: string) => {
        const tab = tabs.find(t => t.id === id);
        if (!tab || !tab.path) {
            closeTab(id);
            return;
        }

        const result = await window.electronAPI.deleteFile(tab.path);
        if (result.success) {
            setTabs(prev => prev.filter(t => t.id !== id));
            if (activeTabId === id) setActiveTabId('');
        } else {
            console.error('Delete failed:', result.error);
        }
    };

    const duplicateTabFile = async (id: string) => {
        const tab = tabs.find(t => t.id === id);
        if (!tab || !tab.path) return;

        const result = await window.electronAPI.duplicateFile(tab.path);
        if (result.success && result.newPath) {
            const newName = result.newPath.split(/[\\/]/).pop() || 'Copy';
            const newContent = await window.electronAPI.readFile(result.newPath);

            setTabs(prev => [...prev, {
                id: Date.now().toString(),
                name: newName,
                path: result.newPath!,
                content: newContent.content || '',
                isDirty: false,
                language: tab.language
            }]);
        }
    };

    return {
        tabs,
        activeTab,
        activeTabId,
        setActiveTabId,
        updateTabContent,
        openFile,
        saveFile,
        setTabs,
        renameTabFile,
        deleteTabFile,
        duplicateTabFile,
        closeTab
    };
};
