import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Search, X, Filter, ChevronDown, Plus, Eye, EyeOff, Copy, Edit2, Trash2, HelpCircle, Check 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, onSnapshot, orderBy } from 'firebase/firestore';

interface FaqTabProps {
  isAdmin: boolean;
  showDashboardNotice: (type: any, message: string, title?: string) => void;
  setConfirmDelete: (config: any) => void;
}

const FaqTab: React.FC<FaqTabProps> = ({
  isAdmin,
  showDashboardNotice,
  setConfirmDelete
}) => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'faqs'), orderBy('order', 'asc')), (snapshot) => {
      setFaqs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const [faqCategoryFilter, setFaqCategoryFilter] = useState('all');
  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [showFaqModal, setShowFaqModal] = useState(false);

  const handleUpdateFaq = async (id: string | undefined, data: any) => {
    try {
      if (id && id !== 'new') {
        await updateDoc(doc(db, 'faqs', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
        showDashboardNotice('success', 'FAQ updated');
      } else {
        await addDoc(collection(db, 'faqs'), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        showDashboardNotice('success', 'FAQ created');
      }
      setShowFaqModal(false);
      setEditingFaq(null);
    } catch (err) {
      handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'faqs');
    }
  };

  const handleDeleteFaq = (id: string) => {
    const faq = faqs.find(f => f.id === id);
    setConfirmDelete({
      title: 'Delete FAQ?',
      message: `Are you sure you want to delete "${faq?.question?.substring(0, 50)}..."?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'faqs', id));
          showDashboardNotice('success', 'FAQ deleted');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `faqs/${id}`);
        }
      }
    });
  };

  const handleToggleFaqStatus = async (id: string, active: boolean) => {
    try {
      await updateDoc(doc(db, 'faqs', id), {
        active: !active,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `faqs/${id}`);
    }
  };

  const handleDuplicateFaq = async (faq: any) => {
    try {
      const { id, createdAt, updatedAt, ...rest } = faq;
      await addDoc(collection(db, 'faqs'), {
        ...rest,
        question: `${rest.question} (Copy)`,
        active: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'faqs');
    }
  };
  const filteredFaqs = (faqs || []).filter(faq => {
    const matchesSearch =
      faq.question?.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
      faq.answer?.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
      faq.category?.toLowerCase().includes(faqSearchQuery.toLowerCase());

    const matchesCategory = faqCategoryFilter === 'all' || (faq.category || 'General') === faqCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set((faqs || []).map(f => f.category || 'General')));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-display text-gold">FAQ Management</h3>
          <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">Manage structured Q&A</p>
        </div>

        <div className="flex flex-row items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={faqSearchQuery}
              onChange={(e) => setFaqSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all"
            />
            {faqSearchQuery && (
              <button
                onClick={() => setFaqSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="relative shrink-0">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={12} />
            <select
              value={faqCategoryFilter}
              onChange={(e) => setFaqCategoryFilter(e.target.value)}
              className="pl-8 pr-10 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] uppercase tracking-widest font-bold text-white outline-none focus:border-gold transition-all appearance-none cursor-pointer min-w-[140px] custom-select"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              const maxOrder = (faqs || []).length > 0 ? Math.max(...(faqs || []).map(f => f.order || 0)) : 0;
              setEditingFaq({ active: true, order: maxOrder + 1, category: faqCategoryFilter !== 'all' ? faqCategoryFilter : 'General' });
              setShowFaqModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-black font-black uppercase tracking-widest rounded-lg hover:scale-105 transition-all text-xs shrink-0"
          >
            <Plus size={14} /> Add FAQ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {(filteredFaqs || []).map((faq, idx) => (
          <motion.div
            key={faq.id || `faq-mgr-${idx}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="glass p-6 rounded-2xl border border-white/5 group hover:border-gold/30 transition-all flex flex-col md:flex-row gap-6"
          >
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold ring-1 ring-gold/20">
                  {faq.order || 0}
                </div>
                <h4 className="text-lg font-bold text-white leading-tight">{faq.question}</h4>
                {!faq.active && (
                  <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] uppercase tracking-widest font-bold rounded">Inactive</span>
                )}
              </div>
              <p className="text-white/50 text-sm italic line-clamp-2">"{faq.answer}"</p>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] uppercase tracking-widest text-white/40 font-medium">{faq.category || 'General'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-center">
              <button
                onClick={() => handleToggleFaqStatus(faq.id, faq.active)}
                title={faq.active ? "Deactivate" : "Activate"}
                className={cn(
                  "w-10 h-10 rounded-xl border flex items-center justify-center transition-all",
                  faq.active
                    ? "bg-green-500/5 border-green-500/10 text-green-400 hover:bg-green-500 hover:text-white"
                    : "bg-red-500/5 border-red-500/10 text-red-400 hover:bg-red-500 hover:text-white"
                )}
              >
                {faq.active ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                onClick={() => handleDuplicateFaq(faq)}
                title="Duplicate FAQ"
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:bg-gold hover:text-black transition-all"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={() => {
                  setEditingFaq(faq);
                  setShowFaqModal(true);
                }}
                title="Edit FAQ"
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-gold hover:text-black transition-all"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => handleDeleteFaq(faq.id)}
                title="Delete FAQ"
                className="w-10 h-10 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        ))}
        {filteredFaqs.length === 0 && (
          <div className="py-20 text-center glass rounded-3xl border border-white/5 border-dashed">
            <HelpCircle size={48} className="mx-auto mb-4 text-white/20" />
            <p className="text-white/40 italic uppercase tracking-widest text-sm">No FAQs found</p>
          </div>
        )}
      </div>

      {/* FAQ Modal */}
      <AnimatePresence>
        {showFaqModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl glass p-8 rounded-xl border border-gold/20"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingFaq?.id ? 'Edit FAQ' : 'Add FAQ'}
                </h3>
                <button onClick={() => setShowFaqModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Category</label>
                  <div className="flex gap-2">
                    <select
                      value={categories.includes(editingFaq?.category) ? editingFaq.category : 'Manual'}
                      onChange={(e) => {
                        if (e.target.value !== 'Manual') {
                          setEditingFaq({ ...editingFaq, category: e.target.value });
                        }
                      }}
                      className="custom-select flex-1"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="Manual">Add New...</option>
                    </select>
                    {(!categories.includes(editingFaq?.category) || categories.length === 0) && (
                      <input
                        type="text"
                        value={editingFaq?.category || ''}
                        onChange={(e) => setEditingFaq({ ...editingFaq, category: e.target.value })}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-gold transition-all"
                        placeholder="Group name..."
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Question</label>
                  <input
                    type="text"
                    value={editingFaq?.question || ''}
                    onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="e.g. Do you provide baby seats?"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Answer</label>
                  <textarea
                    value={editingFaq?.answer || ''}
                    onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-32 resize-none"
                    placeholder="Provide a clear, detailed answer..."
                  />
                </div>

                <div className="flex gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Priority Order</label>
                    <input
                      type="number"
                      value={editingFaq?.order || 0}
                      onChange={(e) => setEditingFaq({ ...editingFaq, order: parseInt(e.target.value) })}
                      className="w-20 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-center"
                    />
                  </div>
                  <div className="flex-1 flex items-end">
                    <label className="flex items-center gap-3 cursor-pointer group mb-3">
                      <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingFaq?.active ? "bg-gold border-gold" : "border-white/20 group-hover:border-gold")}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={editingFaq?.active || false}
                          onChange={(e) => setEditingFaq({ ...editingFaq, active: e.target.checked })}
                        />
                        {editingFaq?.active && <Check size={12} className="text-black" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/60">Visible</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowFaqModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateFaq(editingFaq.id || 'new', editingFaq)}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {editingFaq?.id ? 'Save Changes' : 'Create FAQ'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FaqTab;
