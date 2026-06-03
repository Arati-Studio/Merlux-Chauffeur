import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Image, FileUp, Copy, Edit2, Eye, Trash2, X, Upload, Save, Loader2 } from 'lucide-react';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { cn, getAssetPath } from '../../lib/utils';

interface MediaTabProps {
  storageUsageBytes: number;
  storageLimitBytes: number;
  mediaList: any[];
  showDashboardNotice: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
}

const MediaTab: React.FC<MediaTabProps> = ({
  storageUsageBytes,
  storageLimitBytes,
  mediaList,
  showDashboardNotice
}) => {
  const [editingMedia, setEditingMedia] = useState<any>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaFolder, setMediaFolder] = useState('general');
  const [newFolder, setNewFolder] = useState('');
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const usage = storageUsageBytes || 0;
  const limit = storageLimitBytes || (1024 * 1024 * 1024);
  const percent = Math.min((usage / limit) * 100, 100);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showDashboardNotice('info', 'Link copied to clipboard');
  };

  const uploadMedia = async (file: File, metadata: any, folder: string) => {
    setUploadingMedia(true);
    try {
      const timestamp = new Date().getTime();
      const filename = `${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      const storagePath = `media/${folder}/${filename}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          // Progress can be tracked here
        },
        (error) => {
          throw error;
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'media'), {
            name: file.name,
            url: downloadURL,
            path: storagePath,
            type: file.type,
            size: file.size,
            folder: folder,
            alt: metadata.alt || '',
            title: metadata.title || '',
            caption: metadata.caption || '',
            description: metadata.description || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          setUploadingMedia(false);
          setShowMediaModal(false);
          setEditingMedia(null);
          setMediaFile(null);
          showDashboardNotice('success', 'File uploaded successfully');
        }
      );
    } catch (err) {
      console.error('Upload error:', err);
      handleFirestoreError(err, OperationType.WRITE, 'media/upload');
      setUploadingMedia(false);
    }
  };

  const handleUpdateMedia = async (id: string, data: any) => {
    try {
      await updateDoc(doc(db, 'media', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setShowMediaModal(false);
      setEditingMedia(null);
      showDashboardNotice('success', 'Media info updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `media/${id}`);
    }
  };

  const handleDeleteMedia = async (id: string, urlPath: string) => {
    if (!window.confirm('Delete this media permanently?')) return;
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'media', id));
      // Delete from Storage
      const fileRef = ref(storage, urlPath);
      await deleteObject(fileRef);
      showDashboardNotice('success', 'Media deleted');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `media/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-display text-gold">Media Library</h3>
          <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">
            Manage images and files ({percent.toFixed(1)}% of free tier used)
          </p>
          <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gold"
              style={{ width: `${percent}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-white/30 mt-1">
            {(usage / (1024 * 1024)).toFixed(2)} MB / {(limit / (1024 * 1024 * 1024)).toFixed(0)} GB
          </p>
        </div>
        <button
          onClick={() => {
            setEditingMedia({ alt: '', title: '', description: '', caption: '' });
            setMediaFile(null);
            setShowMediaModal(true);
          }}
          className="btn-primary px-6 py-2 flex items-center gap-2"
        >
          <Plus size={18} />
          <span className="text-xs font-bold uppercase tracking-widest">Upload Media</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
        {(mediaList || []).map((media, idx) => (
          <motion.div
            layout
            key={media.u_key || media.id || `media-${idx}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-[#050505] rounded-xl overflow-hidden border border-white/5 hover:border-gold/30 transition-all duration-500"
          >
            {/* Media Preview Area */}
            <div className="aspect-square flex items-center justify-center overflow-hidden bg-black/40">
              {media.type?.startsWith('image/') ? (
                <img
                  src={getAssetPath(media.url)}
                  alt={media.alt || media.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileUp className="text-white/20" size={32} />
                  <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium">
                    {media.type?.split('/')[1] || 'FILE'}
                  </span>
                </div>
              )}

              {/* Top Metadata Badge */}
              <div className="absolute top-2 left-2 z-10">
                <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[8px] uppercase tracking-widest font-black text-gold">
                  {media.folder || 'General'}
                </span>
              </div>
            </div>

            {/* Content & Hidden Actions Area */}
            <div className="p-3 bg-black/60 backdrop-blur-sm border-t border-white/5">
              <div className="flex justify-between items-start mb-1 gap-2">
                <p className="text-[11px] text-white/90 truncate font-medium flex-1" title={media.name}>
                  {media.name}
                </p>
                <span className="text-[9px] text-white/30 font-mono tracking-tighter">
                  {(media.size / 1024).toFixed(1)}K
                </span>
              </div>

              {/* Expandable Actions on Hover */}
              <div className="max-h-0 group-hover:max-h-24 overflow-hidden transition-all duration-500 ease-out">
                <div className="pt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyUrl(media.url)}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-gold/10 hover:text-gold border border-white/10 hover:border-gold/30 rounded text-[9px] uppercase font-bold tracking-widest transition-all"
                  >
                    <Copy size={10} /> Link
                  </button>
                  <button
                    onClick={() => {
                      setEditingMedia(media);
                      setMediaFile(null);
                      setMediaFolder(media.folder || 'general');
                      setShowMediaModal(true);
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-white/10 rounded text-[9px] uppercase font-bold tracking-widest transition-all"
                  >
                    <Edit2 size={10} /> Edit
                  </button>
                  <a
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-white/10 rounded text-[9px] uppercase font-bold tracking-widest transition-all"
                  >
                    <Eye size={10} /> View
                  </a>
                  <button
                    onClick={() => handleDeleteMedia(media.id, media.path || media.url)}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-red-500/5 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/30 rounded text-[9px] uppercase font-bold tracking-widest transition-all"
                  >
                    <Trash2 size={10} /> Delete
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {(mediaList || []).length === 0 && (
          <div className="col-span-full py-20 text-center glass rounded-2xl border border-white/5 border-dashed">
            <Image size={48} className="mx-auto mb-4 text-white/20" />
            <p className="text-white/50 text-sm uppercase tracking-widest">No Media Found</p>
          </div>
        )}
      </div>

      {/* Media Upload/Edit Modal */}
      <AnimatePresence>
        {showMediaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-6 md:p-8 rounded-sm text-center border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingMedia?.id ? 'Edit Media Info' : 'Upload Media'}
                </h3>
                <button onClick={() => {
                  setShowMediaModal(false);
                  setMediaFile(null);
                  setEditingMedia(null);
                }} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 text-left">
                {!editingMedia?.id && (
                  <>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Folder (Required)</label>
                      <select
                        value={mediaFolder}
                        onChange={(e) => setMediaFolder(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white/70 custom-select"
                      >
                        <option value="general">General</option>
                        <option value="blog">Blog</option>
                        <option value="offers">Offers</option>
                        <option value="tours">Tours</option>
                        <option value="pages">Pages</option>
                        <option value="new">-- Add New Folder --</option>
                      </select>
                    </div>
                    {mediaFolder === 'new' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">New Folder Name (Required)</label>
                        <input
                          type="text"
                          value={newFolder}
                          onChange={(e) => setNewFolder(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white"
                          placeholder="Folder Name"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">File (Required)</label>
                      <input
                        type="file"
                        onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white/70"
                      />
                      {mediaFile && (
                        <div className="mt-2 text-[10px] text-white/50 flex items-center gap-2 bg-white/5 p-2 rounded-lg">
                          <Image size={12} className="text-gold" />
                          <span className="truncate flex-1">{mediaFile.name}</span>
                          <span>({(mediaFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Title (Optional)</label>
                  <input
                    type="text"
                    value={editingMedia?.title || ''}
                    onChange={(e) => setEditingMedia({ ...editingMedia, title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white"
                    placeholder="Image Title"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Alt Text (Optional)</label>
                  <input
                    type="text"
                    value={editingMedia?.alt || ''}
                    onChange={(e) => setEditingMedia({ ...editingMedia, alt: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white"
                    placeholder="Alt attribute for SEO"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Caption (Optional)</label>
                  <input
                    type="text"
                    value={editingMedia?.caption || ''}
                    onChange={(e) => setEditingMedia({ ...editingMedia, caption: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white"
                    placeholder="Visible caption"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Description (Optional)</label>
                  <textarea
                    value={editingMedia?.description || ''}
                    onChange={(e) => setEditingMedia({ ...editingMedia, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-gold transition-all resize-none h-24 text-white"
                    placeholder="Internal description"
                  />
                </div>

                <button
                  disabled={uploadingMedia || (!editingMedia?.id && (mediaFolder === 'new' && !newFolder))}
                  onClick={() => {
                    if (editingMedia?.id) {
                      handleUpdateMedia(editingMedia.id, editingMedia);
                    } else if (mediaFile) {
                      const finalFolder = mediaFolder === 'new' ? newFolder : mediaFolder;
                      uploadMedia(mediaFile, editingMedia || {}, finalFolder);
                    } else {
                      showDashboardNotice('warning', 'Please select a file to upload.', 'Missing File');
                    }
                  }}
                  className="w-full btn-primary py-4 rounded-xl flex items-center justify-center gap-3 transition-all relative overflow-hidden group mt-4"
                >
                  {uploadingMedia ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-[0.2em]">Processing...</span>
                    </>
                  ) : (
                    <>
                      {editingMedia?.id ? <Save size={18} /> : <Upload size={18} />}
                      <span className="text-xs font-bold uppercase tracking-[0.2em]">
                        {editingMedia?.id ? 'Save Changes' : 'Confirm Upload'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MediaTab;

