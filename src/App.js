import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Mic, Send, Volume2, Copy, Check, Settings, X, ArrowDown, KeyRound, LogOut } from 'lucide-react';
import './App.css';

// --- Main App Component ---
export default function App() {
  const [theme, setTheme] = useState('dark');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ voiceOutput: true });
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(true);
  const [tempApiKey, setTempApiKey] = useState('');

  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- Effects ---
  useEffect(() => {
    // Theme management from localStorage
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    const savedApiKey = localStorage.getItem('rugved_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      setShowApiModal(false);
    }
  }, []);

  useEffect(() => {
    // Apply theme to HTML element
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Auto-resize textarea based on content
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    // Scroll to the bottom of the chat container when new messages arrive
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Setup Web Speech API for voice input
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
      };
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);
  
  useEffect(() => {
    // Show/hide the "scroll to bottom" button
    const handleScroll = () => {
        if (chatContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
            setShowScrollDown(scrollHeight - scrollTop > clientHeight + 150);
        }
    };
    const chatContainer = chatContainerRef.current;
    chatContainer?.addEventListener('scroll', handleScroll);
    return () => chatContainer?.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Functions ---
  const scrollToBottom = () => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
  };
  
  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    if (tempApiKey) {
      setApiKey(tempApiKey);
      localStorage.setItem('rugved_api_key', tempApiKey);
      setShowApiModal(false);
    }
  };

  const handleLogout = () => {
    setApiKey('');
    localStorage.removeItem('rugved_api_key');
    setShowApiModal(true);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (input.trim() === '' || isTyping) return;

    const userMessage = { text: input, sender: 'user', id: Date.now() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
        const chatHistory = newMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`An error occurred. Please try again.`);
        }

        const result = await response.json();
        let aiResponseText = '';

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            aiResponseText = result.candidates[0].content.parts[0].text;
            
            // Clean up the response text
            aiResponseText = aiResponseText
                .replace(/\*\*/g, '') // Remove asterisks
                .replace(/\*/g, '') // Remove single asterisks
                .replace(/^\s*[-*]\s*/gm, '') // Remove list markers
                .replace(/^\s*[0-9]+\.\s*/gm, '') // Remove numbered list markers
                .replace(/^\s*[-*+]\s*/gm, '') // Remove bullet points
                .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
                .trim();
        } else {
            aiResponseText = "I'm sorry, I couldn't generate a response. Please try again.";
        }
        
        const aiMessage = { text: aiResponseText, sender: 'ai', id: Date.now() + 1 };
        setMessages(prev => [...prev, aiMessage]);
        
        if (settings.voiceOutput) {
            speak(aiResponseText.trim());
        }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { text: `Sorry, an error occurred. Please try again.`, sender: 'ai', error: true, id: Date.now() + 1 };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
    setIsRecording(!isRecording);
  };

  const speak = (text) => {
    if ('speechSynthesis' in window && text) {
      // Clean text for speech synthesis
      const cleanText = text
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\*\*/g, '') // Remove asterisks
        .replace(/\*/g, '') // Remove single asterisks
        .replace(/`/g, '') // Remove backticks
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      speechSynthesis.cancel(); // Cancel any previous speech
      speechSynthesis.speak(utterance);
    }
  };

  const toggleTheme = () => {
    // Theme is always dark
    setTheme('dark');
  };

  const handleSettingsChange = (setting) => {
    setSettings(prev => ({ ...prev, [setting]: !prev[setting] }));
  };

  // Function to format text with proper styling
  const formatText = (text) => {
    if (!text) return '';
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
      .replace(/`(.*?)`/g, '<code>$1</code>') // Code
      .replace(/"(.*?)"/g, '<strong>"$1"</strong>') // Bold quotes
      .replace(/\n/g, '<br>'); // Line breaks
  };

  // --- Render ---
  return (
    <div 
      className="flex h-screen w-screen text-gray-100 font-sans"
      style={{
        backgroundImage: 'url(/rugved%20background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#000000'
      }}
    >
      {/* --- Login Modal --- */}
       <AnimatePresence>
        {showApiModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-black border border-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="text-white" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to Rugved AI</h2>
                <p className="text-gray-400">Enter your access key to continue</p>
              </div>
              
              <form onSubmit={handleApiKeySubmit} className="space-y-4">
                <div className="relative">
                  <input 
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="Enter your access key"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-black hover:bg-gray-800 border border-gray-600 text-white rounded-xl py-3 font-semibold transition-colors duration-200"
                >
                  Continue
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Main Chat Area --- */}
      <div className="flex flex-col flex-1 bg-black bg-opacity-50 backdrop-blur-sm">
        <header className="flex items-center justify-between p-4 border-b border-gray-800 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <img 
              src="/rugved%20logo.png" 
              alt="Rugved AI" 
              className="w-10 h-10 rounded-xl object-cover"
            />
            <h1 className="text-xl font-bold text-white">RUGVED AI</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-xl hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
            >
              <Moon size={20} />
            </button>
            <button 
              onClick={() => setShowSettings(true)} 
              className="p-2 rounded-xl hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-transparent">
          {messages.length === 0 && !isTyping && (
            <div className="text-center text-gray-500 mt-20">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">Ask me anything!</p>
            </div>
          )}
          
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} formatText={formatText} />
            ))}
          </AnimatePresence>
          {isTyping && <TypingIndicator />}
          {showScrollDown && (
            <button 
              onClick={scrollToBottom} 
              className="absolute bottom-20 right-8 bg-black hover:bg-gray-800 border border-gray-600 text-white p-3 rounded-full shadow-lg transition-colors z-10"
            >
                <ArrowDown size={20} />
            </button>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 bg-black/50 backdrop-blur-sm">
          <div className="relative bg-black border border-gray-600 rounded-xl flex items-end p-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-base mx-2 max-h-48 text-white placeholder-gray-400"
            />
            <button 
              onClick={handleMicClick} 
              className={`p-2 rounded-xl transition-colors ${
                isRecording 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'hover:bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              <Mic size={20} />
            </button>
            <button 
              onClick={handleSendMessage} 
              disabled={isTyping || !input.trim()} 
              className="p-2 rounded-xl bg-black hover:bg-gray-800 border border-gray-600 text-white ml-2 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* --- Settings Modal --- */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Settings</h2>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="p-2 rounded-xl hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-xl">
                  <span className="text-white">Voice Output</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={settings.voiceOutput} 
                      onChange={() => handleSettingsChange('voiceOutput')} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---
const MessageBubble = ({ message, formatText }) => {
  const { text, sender, error } = message;
  const isUser = sender === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if(text) {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window && text) {
      const utterance = new SpeechSynthesisUtterance(text);
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}
    >
      {!isUser && (
        <img 
          src="/rugved%20logo.png" 
          alt="Rugved AI" 
          className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
        />
      )}
      <div className={`max-w-xl p-3 rounded-xl ${
        isUser 
          ? 'bg-black border border-gray-600 text-white' 
          : 'bg-gray-800 border border-gray-700 text-gray-100'
      } ${error ? 'bg-red-900 border-red-600 text-red-200' : ''}`}>
        <div 
          className="whitespace-pre-wrap leading-relaxed"
          dangerouslySetInnerHTML={{ __html: isUser ? text : formatText(text) }}
        />
        {!isUser && text && !error && (
          <div className="flex items-center gap-2 mt-3 text-gray-400">
            <button 
              onClick={handleCopy} 
              className="hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
            <button 
              onClick={handleSpeak} 
              className="hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
            >
              <Volume2 size={16} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3"
  >
    <img 
      src="/rugved%20logo.png" 
      alt="Rugved AI" 
      className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
    />
    <div className="flex items-center space-x-1 p-3 bg-gray-800 border border-gray-700 rounded-xl">
      <motion.div
        className="w-2 h-2 bg-gray-400 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="w-2 h-2 bg-gray-400 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.div
        className="w-2 h-2 bg-gray-400 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
    </div>
  </motion.div>
);
