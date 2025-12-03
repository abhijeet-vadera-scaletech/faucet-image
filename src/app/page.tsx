"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";

interface FaucetMatch {
  filename: string;
  title?: string;
  brand?: string;
  color?: string;
  confidence: number;
  reasoning: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text?: string;
  imageUrl?: string;
  matches?: FaucetMatch[];
  assistantMessage?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidImageFile(droppedFile)) {
      simulateUpload(droppedFile);
    }
  }, []);

  const isValidImageFile = (file: File) => {
    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    return validTypes.includes(file.type) && file.size <= 200 * 1024 * 1024;
  };

  const simulateUpload = (selectedFile: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setFile(selectedFile);
          return 100;
        }
        return prev + 10;
      });
    }, 50);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidImageFile(selectedFile)) {
      simulateUpload(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + "B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
    return (bytes / (1024 * 1024)).toFixed(1) + "MB";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() && !file) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      text: message.trim() || undefined,
      imageUrl: file ? URL.createObjectURL(file) : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (message.trim()) {
        formData.append("message", message.trim());
      }
      if (file) {
        formData.append("image", file);
      }

      // Include conversation history
      formData.append("history", JSON.stringify(messages));

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze image");
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        assistantMessage: data.message,
        matches: data.matches,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        text: `Error: ${
          error instanceof Error ? error.message : "Something went wrong"
        }`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setMessage("");
      setFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setTimeout(scrollToBottom, 100);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f172a] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2 italic">
          Faucet Finder Chat
        </h1>
        <p className="text-gray-400 mb-8">
          Ask the assistant to identify faucets and upload photos when needed.
        </p>

        {/* Chat Messages */}
        {messages.length > 0 && (
          <div className="mb-6 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className="space-y-3">
                {msg.role === "user" && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-medium">
                      U
                    </div>
                    <div className="flex-1">
                      {msg.text && <p className="text-white">{msg.text}</p>}
                      {msg.imageUrl && (
                        <div className="mt-2">
                          <p className="text-orange-400 text-sm mb-2">
                            (Image only)
                          </p>
                          <img
                            src={msg.imageUrl}
                            alt="Uploaded faucet"
                            className="max-w-xs rounded-lg border border-gray-700"
                          />
                          <p className="text-gray-500 text-sm mt-1">
                            Uploaded faucet
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {msg.role === "assistant" && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-medium">
                      AI
                    </div>
                    <div className="flex-1">
                      {msg.text && <p className="text-white">{msg.text}</p>}
                      {msg.assistantMessage && (
                        <p className="text-white mb-4">
                          {msg.assistantMessage}
                        </p>
                      )}
                      {msg.matches && msg.matches.length > 0 && (
                        <div className="space-y-6">
                          {msg.matches.map((match, matchIndex) => (
                            <div
                              key={matchIndex}
                              className="border-l-2 border-gray-700 pl-4"
                            >
                              <h4 className="text-white font-medium">
                                Match {matchIndex + 1}: {match.filename}{" "}
                                (confidence: {match.confidence.toFixed(2)})
                              </h4>
                              <p className="text-gray-300 mt-1">
                                {match.reasoning}
                              </p>
                              {(match.title || match.brand || match.color) && (
                                <p className="text-gray-500 text-sm mt-2">
                                  Title: {match.title || "N/A"} | Brand:{" "}
                                  {match.brand || "N/A"} | Color:{" "}
                                  {match.color || "N/A"}
                                </p>
                              )}
                              {match.filename && (
                                <div className="mt-3">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`/api/catalog-image/${encodeURIComponent(
                                      match.filename
                                    )}`}
                                    alt={`Catalog image: ${match.filename}`}
                                    className="max-w-xs rounded-lg border border-gray-700 bg-white"
                                  />
                                  <p className="text-gray-500 text-sm mt-1">
                                    Catalog image: {match.filename}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Finding the best match...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#1e293b] rounded-lg p-4 border border-gray-700"
        >
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the faucet or ask for help..."
              className="w-full bg-[#334155] text-white rounded-lg p-3 min-h-[80px] resize-y border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-2">
              Optional: upload a faucet photo
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-[#334155] rounded-lg p-4 border-2 border-dashed transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#475569] flex items-center justify-center">
                    <Upload className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm">
                      Drag and drop file here
                    </p>
                    <p className="text-gray-500 text-xs">
                      Limit 200MB per file • PNG, JPG, JPEG
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#475569] text-white rounded-lg hover:bg-[#64748b] transition-colors text-sm"
                >
                  Browse files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* File Upload Progress / Preview */}
          {(isUploading || file) && (
            <div className="mb-4 flex items-center gap-3 bg-[#334155] rounded-lg p-3">
              <div className="w-8 h-8 rounded bg-[#475569] flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">
                  {file?.name || "Uploading..."}
                </p>
                {isUploading ? (
                  <div className="mt-1 h-1 bg-[#475569] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-100"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs">
                    {file && formatFileSize(file.size)}
                  </p>
                )}
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={removeFile}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || isUploading || (!message.trim() && !file)}
            className="px-6 py-2 bg-[#334155] text-white rounded-lg hover:bg-[#475569] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
