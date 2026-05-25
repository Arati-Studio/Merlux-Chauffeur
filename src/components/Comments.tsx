import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, Trash2, Calendar, User as UserIcon, Edit2, X, Check } from 'lucide-react';
import LoginInline from './LoginInline';
import { cn } from '../lib/utils';
import { FormNotice, NoticeType } from './FormNotice';

interface CommentsProps {
  targetId: string;
  targetType: 'blog' | 'page';
}

const handleFirestoreError = (error: unknown, operationType: string, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

export default function Comments({ targetId, targetType }: CommentsProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    const q = query(
      collection(db, 'comments'),
      where('targetId', '==', targetId),
      where('targetType', '==', targetType),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeComments = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error('Snapshot error:', err);
      // If index is building, we'll get an error initially
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeComments();
    };
  }, [targetId, targetType]);

  const showNotice = (type: NoticeType, message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newComment.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'comments'), {
        targetId,
        targetType,
        content: newComment.trim(),
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
        authorAvatar: currentUser.photoURL || '',
        active: true,
        createdAt: serverTimestamp()
      });
      setNewComment('');
      showNotice('success', 'Comment posted successfully');
    } catch (err) {
      handleFirestoreError(err, 'create', 'comments');
      showNotice('error', 'Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isUserAdmin = currentUser?.email === 'keliztan20@gmail.com';

  const handleUpdate = async (commentId: string) => {
    if (!editValue.trim()) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'comments', commentId), {
        content: editValue.trim(),
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
      showNotice('success', 'Comment updated');
    } catch (err) {
      showNotice('error', 'Failed to update comment');
      handleFirestoreError(err, 'update', `comments/${commentId}`);
    } finally {
      setSubmitting(false);
    }
  };

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const handleDelete = async (commentId: string) => {
    if (confirmingDeleteId !== commentId) {
      setConfirmingDeleteId(commentId);
      return;
    }

    setSubmitting(true);
    try {
      const commentRef = doc(db, 'comments', commentId);
      await deleteDoc(commentRef);
      showNotice('success', 'Comment deleted successfully');
      setConfirmingDeleteId(null);
    } catch (err) {
      showNotice('error', 'Could not delete: Permission denied or network issue.');
      handleFirestoreError(err, 'delete', `comments/${commentId}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' | ' + date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="mt-20 pt-20 border-t border-white/5">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center border border-gold/20">
          <MessageSquare className="text-gold" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-display uppercase tracking-tight">Discussion</h2>
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
            {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <div className="mb-8">
            <FormNotice
              type={notice.type}
              message={notice.message}
              isFloating={false}
              onClose={() => setNotice(null)}
            />
          </div>
        )}
      </AnimatePresence>

      {currentUser ? (
        <form onSubmit={handleSubmit} className="mb-12">
          <div className="relative group">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Join the luxury lifestyle discussion..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 pt-16 outline-none focus:border-gold transition-all min-h-[150px] text-white resize-none"
              required
            />
            <div className="absolute top-6 left-6 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center border border-white/10 overflow-hidden">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt={currentUser.displayName || ''} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={14} className="text-gold" />
                )}
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">
                Posting as <span className="text-gold">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="absolute bottom-6 right-6 bg-gold text-black px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-gold/20"
            >
              {submitting ? 'Posting...' : (
                <>
                  Post Comment <Send size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-12 glass p-8 rounded-3xl border border-white/5">
          <p className="text-white/60 mb-8 text-sm italic font-medium">Please sign in to share your thoughts on this exclusive content.</p>
          <LoginInline />
        </div>
      )}

      <div className="space-y-8">
        <AnimatePresence mode="popLayout" initial={false}>
          {comments.map((comment, idx) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.05 }}
              className="glass p-8 rounded-[2rem] relative group border border-white/5 hover:border-gold/20 transition-all duration-500"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
                    {comment.authorAvatar ? (
                      <img src={comment.authorAvatar} alt={comment.authorName} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={20} className="text-white/20" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gold uppercase tracking-widest">
                      {comment.authorName}
                    </h4>
                    <p className="text-[10px] text-white/40 flex items-center gap-2 font-bold mt-1">
                      <Calendar size={12} className="text-white/20" /> {formatTimestamp(comment.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(currentUser?.uid === comment.authorId || isUserAdmin) && (
                    <button
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditValue(comment.content);
                      }}
                      className="p-2.5 text-white/20 hover:text-gold transition-all opacity-0 group-hover:opacity-100 bg-white/5 rounded-lg border border-white/10"
                      title="Edit Comment"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {(currentUser?.uid === comment.authorId || isUserAdmin) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className={cn(
                        "px-2.5 py-2.5 rounded-lg border transition-all flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest",
                        confirmingDeleteId === comment.id 
                          ? "bg-red-500/20 text-red-500 border-red-500/50 opacity-100" 
                          : "text-white/20 hover:text-red-500 bg-white/5 border-white/10 opacity-0 group-hover:opacity-100"
                      )}
                      title={confirmingDeleteId === comment.id ? "Confirm Delete" : "Delete Comment"}
                    >
                      {confirmingDeleteId === comment.id ? (
                        <>Confirm?</>
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {editingId === comment.id ? (
                <div className="space-y-4">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full bg-black/40 border border-gold/40 rounded-xl p-4 text-sm text-white outline-none min-h-[100px] resize-none focus:ring-1 focus:ring-gold"
                    autoFocus
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-2"
                    >
                      Cancel <X size={14} />
                    </button>
                    <button
                      onClick={() => handleUpdate(comment.id)}
                      disabled={submitting}
                      className="bg-gold text-black px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2"
                    >
                      {submitting ? 'Updating...' : <>Save <Check size={14} /></>}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-white/70 leading-relaxed text-sm font-medium">
                  {comment.content}
                </p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && comments.length === 0 && (
          <div className="text-center py-20 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 flex flex-col items-center gap-4">
            <MessageSquare size={32} className="text-white/10" />
            <p className="text-white/40 italic text-sm font-medium">No discussions yet. Be the first to start the conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
