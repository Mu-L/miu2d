/**
 * 文件管理器组件
 *
 * 重构后：所有状态集中在 FileManagerContext，
 * FileManager 本身只负责布局和组装子组件。
 */
import { useCallback, useMemo, useState } from "react";
import { useDashboard } from "../../DashboardContext";
import { ContextMenu } from "./ContextMenu";
import { ConfirmDialog, InputDialog } from "./Dialogs";
import { FileManagerProvider, useFileManager } from "./FileManagerContext";
import { FilePreview } from "./FilePreview";
import { FileTree } from "./FileTree";
import type { FlatFileTreeNode } from "./types";
import { UploadQueue } from "./UploadProgress";

/**
 * 外层：提供 Context
 */
export function FileManager() {
  const { currentGame } = useDashboard();

  if (!currentGame) {
    return (
      <div className="h-full flex items-center justify-center text-[#666]">请先选择游戏空间</div>
    );
  }

  return (
    <FileManagerProvider>
      <FileManagerInner />
    </FileManagerProvider>
  );
}

/**
 * 内层：消费 Context 并渲染布局
 */
function FileManagerInner() {
  const ctx = useFileManager();
  const {
    treeNodes,
    expandedState,
    setExpandedState,
    selectedNode,
    isLoadingRoot,
    expandNode,
    selectNode,
    clearSelection,
    refreshAll,
    renameNode,
    moveNode,
    deleteNode,
    isDeleting,
    uploads,
    isProcessingDrop,
    handleDropUpload,
    handleFileInputUpload,
    renamingId,
    setRenamingId,
    contextMenu,
    openContextMenu,
    closeContextMenu,
    dialog,
    openDialog,
    closeDialog,
    createFolder,
    createFile,
    fileInputRef,
  } = ctx;

  // --- 拖拽覆盖层 ---
  const [isTreeDragOver, setIsTreeDragOver] = useState(false);

  const handleTreeDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsTreeDragOver(true);
    }
  }, []);

  const handleTreeDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setIsTreeDragOver(false);
    }
  }, []);

  const handleTreeDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsTreeDragOver(false);
      if (e.dataTransfer.types.includes("Files")) {
        const targetParent = selectedNode?.isDirectory
          ? selectedNode.id
          : (selectedNode?.parentId ?? null);
        handleDropUpload(e.dataTransfer, targetParent);
      }
    },
    [selectedNode, handleDropUpload]
  );

  // --- 获取当前操作的目标父目录 ---
  const getTargetParentId = useCallback(
    () => (selectedNode?.isDirectory ? selectedNode.id : (selectedNode?.parentId ?? null)),
    [selectedNode]
  );

  // --- 右键菜单项（基于 contextMenu.node） ---
  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];
    const node = contextMenu.node;
    const items = [];

    if (node.isDirectory) {
      items.push({
        label: "新建文件夹",
        onClick: () => openDialog("newFolder", node.id),
      });
      items.push({
        label: "新建文件",
        onClick: () => openDialog("newFile", node.id),
      });
      items.push({ label: "", divider: true, onClick: () => {} });
    }

    items.push({
      label: "重命名",
      onClick: () => setRenamingId(node.id),
    });

    items.push({
      label: "删除",
      danger: true,
      onClick: () => {
        selectNode(node);
        openDialog("delete");
      },
    });

    return items;
  }, [contextMenu, openDialog, setRenamingId, selectNode]);

  // --- 对话框回调 ---
  const handleCreateFolderConfirm = useCallback(
    async (name: string) => {
      try {
        await createFolder(name, dialog.targetParentId);
      } finally {
        closeDialog();
      }
    },
    [createFolder, dialog.targetParentId, closeDialog]
  );

  const handleCreateFileConfirm = useCallback(
    async (name: string) => {
      try {
        await createFile(name, dialog.targetParentId);
      } finally {
        closeDialog();
      }
    },
    [createFile, dialog.targetParentId, closeDialog]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedNode) return;
    try {
      await deleteNode(selectedNode);
    } finally {
      closeDialog();
      clearSelection();
    }
  }, [selectedNode, deleteNode, closeDialog, clearSelection]);

  const handleRename = useCallback(
    async (node: FlatFileTreeNode, newName: string) => {
      await renameNode(node, newName);
      setRenamingId(null);
    },
    [renameNode, setRenamingId]
  );

  return (
    <div
      className="h-full flex bg-[#1e1e1e] relative"
      onDragOver={handleTreeDragOver}
      onDragLeave={handleTreeDragLeave}
      onDrop={handleTreeDrop}
    >
      {/* 全局拖拽提示 */}
      {isTreeDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-[#094771]/30 border-2 border-dashed border-[#0e639c]">
          <div className="text-center text-[#0e639c]">
            <div className="text-3xl mb-2">📥</div>
            <p className="text-sm">拖放文件/文件夹到此处上传</p>
          </div>
        </div>
      )}
      {/* 解析文件/文件夹中 */}
      {isProcessingDrop && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-[#1e1e1e]/70">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-[#0e639c] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-[#cccccc]">正在解析文件...</p>
          </div>
        </div>
      )}
      {/* 左侧：目录树 */}
      <div className="w-[280px] flex flex-col border-r border-widget-border relative">
        {/* 工具栏 */}
        <div className="flex items-center justify-end px-3 py-2 border-b border-widget-border bg-[#252526]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => openDialog("newFile", getTargetParentId())}
              className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-white transition-colors"
              title="新建文件"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.5 1H4.5L4 1.5V4H2.5L2 4.5v10l.5.5h7l.5-.5V14H12.5l.5-.5V4l-3-3h-.5zM9 2.5l2.5 2.5H9V2.5zM3 5H4v8.5l.5.5H9v1H3V5zm6 9V10H6.5L6 9.5V6h3.5l.5-.5V2H5v7h4.5l.5.5V14H9z" />
              </svg>
            </button>
            <button
              onClick={() => openDialog("newFolder", getTargetParentId())}
              className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-white transition-colors"
              title="新建文件夹"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 4H9.618l-1-2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm0 9H2V5h12v8z" />
                <path d="M8 6v2H6v1h2v2h1V9h2V8H9V6H8z" />
              </svg>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-white transition-colors"
              title="上传文件"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.5 1L3 5.5V6h2V4.5l2.5-2 2.5 2V6h2v-.5L7.5 1zM3 14V7h1v6.5l.5.5h7l.5-.5V7h1v7l-1 1H4l-1-1z" />
              </svg>
            </button>
            <button
              onClick={refreshAll}
              className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-white transition-colors"
              title="刷新"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c-.335.415-.927 1.341-1.124 2.876l-.021.165.033.163.071.345c.442 1.654.291 2.9-.449 3.709-.623.68-1.548.828-2.238.828-1.426 0-2.5-1.01-2.5-2.35 0-1.341.846-2.35 1.969-2.35.715 0 1.271.358 1.531.984l.083.202.205-.075c.212-.078.568-.278.705-.41l.108-.105-.103-.109c-.512-.543-1.337-.867-2.206-.867C5.466 8.592 4 10.209 4 12.312c0 2.025 1.543 3.688 3.438 3.688 1.11 0 2.31-.316 3.212-1.300 1.096-1.196 1.285-2.874.564-4.993l-.065-.19.073-.185c.272-.69.71-1.431 1.029-1.796l.137-.155.072.155.06.13 1.018-.588-.087-.145-.001-.003z" />
              </svg>
            </button>
          </div>
        </div>

        {/* 文件树 */}
        <div className="flex-1 overflow-hidden">
          {isLoadingRoot ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 border-2 border-[#0e639c] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <FileTree
              nodes={treeNodes}
              selectedId={selectedNode?.id}
              expandedState={expandedState}
              onExpandedChange={setExpandedState}
              onSelect={(node) => (node ? selectNode(node) : clearSelection())}
              onExpand={expandNode}
              onContextMenu={openContextMenu}
              onRename={handleRename}
              onMove={moveNode}
              onFileDrop={handleDropUpload}
              onDropComplete={() => setIsTreeDragOver(false)}
              renamingId={renamingId}
              onRenameCancel={() => setRenamingId(null)}
            />
          )}
        </div>

        {/* 上传队列 */}
        <UploadQueue uploads={uploads} />

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFileInputUpload(e.target.files, getTargetParentId());
              e.target.value = "";
            }
          }}
        />
      </div>

      {/* 右侧：预览区 */}
      <div className="flex-1 overflow-hidden">
        <FilePreview file={selectedNode} />
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
        />
      )}

      {/* 新建文件夹对话框 */}
      {dialog.type === "newFolder" && (
        <InputDialog
          title="新建文件夹"
          placeholder="文件夹名称"
          confirmText="创建"
          onConfirm={handleCreateFolderConfirm}
          onCancel={closeDialog}
        />
      )}

      {/* 新建文件对话框 */}
      {dialog.type === "newFile" && (
        <InputDialog
          title="新建文件"
          placeholder="文件名（包含扩展名）"
          confirmText="创建"
          onConfirm={handleCreateFileConfirm}
          onCancel={closeDialog}
        />
      )}

      {/* 删除确认对话框 */}
      {dialog.type === "delete" && selectedNode && (
        <ConfirmDialog
          title="确认删除"
          message={
            <div>
              确定要删除{selectedNode.isDirectory ? "文件夹" : "文件"}{" "}
              <span className="text-white font-medium">"{selectedNode.name}"</span>
              {selectedNode.isDirectory && " 及其所有内容"}？
              <p className="text-red-400 text-[12px] mt-2">此操作不可撤销！</p>
            </div>
          }
          confirmText="删除"
          danger
          loading={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
