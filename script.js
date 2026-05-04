(function() {
    'use strict';

    // ---------- عناصر DOM الأساسية ----------
    const taskForm = document.getElementById('taskForm');
    const taskTitleInput = document.getElementById('taskTitle');
    const taskDueDateInput = document.getElementById('taskDueDate');
    const taskPrioritySelect = document.getElementById('taskPriority');
    const editIdInput = document.getElementById('editId');
    const submitBtn = document.getElementById('submitBtn');
    const taskListEl = document.getElementById('taskList');
    const searchInput = document.getElementById('searchInput');
    const filterChips = document.querySelectorAll('.chip');
    const statTotal = document.getElementById('statTotal');
    const statDone = document.getElementById('statDone');
    const statUrgent = document.getElementById('statUrgent');
    const toastContainer = document.getElementById('toastContainer');

    // ---------- حالة التطبيق ----------
    let tasks = []; // مصفوفة المهام
    let currentFilter = 'all'; // الفلتر النشط (all, active, completed, high)
    let searchQuery = ''; // نص البحث

    // ---------- مفتاح التخزين المحلي ----------
    const STORAGE_KEY = 'taskflow_pro_tasks';

    // ============ دوال مساعدة ============

    /** حفظ المهام في Local Storage مع معالجة الأخطاء */
    function saveTasks() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (e) {
            showToast('⚠️ فشل حفظ البيانات - تجاوز سعة التخزين المحلية', 'error');
            console.error('LocalStorage save error:', e);
        }
    }

    /** استرجاع المهام من Local Storage */
    function loadTasks() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    tasks = parsed;
                } else {
                    tasks = [];
                }
            }
        } catch (e) {
            tasks = [];
            showToast('⚠️ تعذر استرجاع البيانات المخزنة - تمت إعادة التعيين', 'error');
            console.error('LocalStorage load error:', e);
        }
    }

    /** إنشاء معرّف فريد لكل مهمة */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    /** عرض إشعار Toast */
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        // إزالة تلقائية بعد انتهاء الأنيميشن
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 3100);
    }

    /** التحقق من صحة بيانات المهمة قبل الحفظ */
    function validateTask(title, dueDate) {
        const errors = [];
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            errors.push('عنوان المهمة مطلوب.');
        }
        if (trimmedTitle.length > 120) {
            errors.push('العنوان طويل جداً (الحد الأقصى 120 حرفاً).');
        }
        // التحقق من أن التاريخ ليس في الماضي البعيد جداً (اختياري: تحذير فقط)
        if (dueDate) {
            const dateObj = new Date(dueDate + 'T00:00:00');
            if (isNaN(dateObj.getTime())) {
                errors.push('صيغة التاريخ غير صالحة.');
            }
        }
        return errors;
    }

    /** تنسيق التاريخ للعرض بالعربية */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return dateStr;
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('ar-SA', options);
    }

    /** التحقق مما إذا كان التاريخ قد تجاوز موعده */
    function isOverdue(dateStr) {
        if (!dateStr) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dateStr + 'T00:00:00');
        return due < today;
    }

    // ============ دوال عرض القائمة ============

    /** فلترة المهام حسب الفلتر الحالي والبحث */
    function getFilteredTasks() {
        let filtered = [...tasks];

        // فلترة حسب الحالة
        if (currentFilter === 'active') {
            filtered = filtered.filter(t => !t.completed);
        } else if (currentFilter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        } else if (currentFilter === 'high') {
            filtered = filtered.filter(t => t.priority === 'high' && !t.completed);
        }

        // فلترة حسب البحث النصي
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            filtered = filtered.filter(t => t.title.toLowerCase().includes(q));
        }

        // ترتيب: غير المكتملة أولاً، ثم حسب الأولوية (عالية > متوسطة > منخفضة)، ثم حسب التاريخ
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        filtered.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
        });

        return filtered;
    }

    /** بناء عنصر DOM لمهمة واحدة */
    function createTaskElement(task) {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.setAttribute('data-id', task.id);

        // مؤشر الأولوية
        const priorityClass = `priority-${task.priority}`;
        const indicator = document.createElement('div');
        indicator.className = `priority-indicator ${priorityClass}`;

        // محتوى المهمة
        const content = document.createElement('div');
        content.className = 'task-content';

        const titleEl = document.createElement('div');
        titleEl.className = 'task-title';
        titleEl.textContent = task.title;

        const metaEl = document.createElement('div');
        metaEl.className = 'task-meta';

        // شارة الأولوية
        const priorityBadge = document.createElement('span');
        priorityBadge.className = `badge badge-${task.priority}`;
        const priorityLabels = { high: '🔴 عالية', medium: '🟡 متوسطة', low: '🟢 منخفضة' };
        priorityBadge.textContent = priorityLabels[task.priority] || task.priority;

        // تاريخ الاستحقاق
        const dateSpan = document.createElement('span');
        if (task.dueDate) {
            const overdue = !task.completed && isOverdue(task.dueDate);
            dateSpan.textContent = '📅 ' + formatDate(task.dueDate);
            if (overdue) {
                dateSpan.classList.add('due-overdue');
                dateSpan.textContent += ' ⚠️ متأخرة';
            }
        } else {
            dateSpan.textContent = '📅 بدون تاريخ';
        }

        metaEl.appendChild(priorityBadge);
        metaEl.appendChild(dateSpan);
        content.appendChild(titleEl);
        content.appendChild(metaEl);

        // أزرار الإجراءات
        const actions = document.createElement('div');
        actions.className = 'task-actions';

        // زر الإكمال / التراجع
        const completeBtn = document.createElement('button');
        completeBtn.className = `icon-btn ${task.completed ? 'success' : ''}`;
        completeBtn.title = task.completed ? 'تراجع عن الإكمال' : 'إكمال المهمة';
        completeBtn.innerHTML = task.completed ? '↩️' : '✅';
        completeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleComplete(task.id);
        });

        // زر التعديل
        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn';
        editBtn.title = 'تعديل المهمة';
        editBtn.innerHTML = '✏️';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startEdit(task);
        });

        // زر الحذف
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn danger';
        deleteBtn.title = 'حذف المهمة';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task.id);
        });

        actions.appendChild(completeBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        li.appendChild(indicator);
        li.appendChild(content);
        li.appendChild(actions);

        return li;
    }

    /** إعادة بناء وعرض قائمة المهام بالكامل */
    function renderTasks() {
        const filtered = getFilteredTasks();
        taskListEl.innerHTML = '';

        if (filtered.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-state';
            emptyDiv.innerHTML =
                '<span class="empty-icon">📋</span><p>لا توجد مهام لعرضها</p><p style="font-size:0.8rem;margin-top:4px;">ابدأ بإضافة مهمة جديدة ✨</p>';
            taskListEl.appendChild(emptyDiv);
        } else {
            filtered.forEach(task => {
                taskListEl.appendChild(createTaskElement(task));
            });
        }

        updateStats();
    }

    /** تحديث الإحصائيات */
    function updateStats() {
        const total = tasks.length;
        const done = tasks.filter(t => t.completed).length;
        const urgent = tasks.filter(t => t.priority === 'high' && !t.completed).length;
        statTotal.textContent = total;
        statDone.textContent = done;
        statUrgent.textContent = urgent;
    }

    // ============ دوال العمليات على المهام ============

    /** إضافة مهمة جديدة أو تحديث موجودة */
    function saveTask(e) {
        e.preventDefault();

        const title = taskTitleInput.value;
        const dueDate = taskDueDateInput.value;
        const priority = taskPrioritySelect.value;
        const editId = editIdInput.value;

        // التحقق من الأخطاء
        const errors = validateTask(title, dueDate);
        if (errors.length > 0) {
            showToast('❌ ' + errors.join(' '), 'error');
            // هز حقل العنوان للإشارة للخطأ
            taskTitleInput.style.borderColor = 'var(--danger)';
            taskTitleInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.25)';
            setTimeout(() => {
                taskTitleInput.style.borderColor = 'var(--border)';
                taskTitleInput.style.boxShadow = '';
            }, 1500);
            return;
        }

        if (editId) {
            // وضع التعديل
            const taskIndex = tasks.findIndex(t => t.id === editId);
            if (taskIndex === -1) {
                showToast('❌ المهمة غير موجودة للتعديل.', 'error');
                resetForm();
                renderTasks();
                return;
            }
            tasks[taskIndex].title = title.trim();
            tasks[taskIndex].dueDate = dueDate;
            tasks[taskIndex].priority = priority;
            showToast('✅ تم تحديث المهمة بنجاح', 'success');
        } else {
            // إضافة جديدة
            const newTask = {
                id: generateId(),
                title: title.trim(),
                dueDate: dueDate,
                priority: priority,
                completed: false,
                createdAt: new Date().toISOString(),
            };
            tasks.push(newTask);
            showToast('🎉 تمت إضافة المهمة بنجاح', 'success');
        }

        saveTasks();
        resetForm();
        renderTasks();
        // محاولة طلب إذن الإشعارات للمهام العالية الأولوية
        requestNotificationPermission();
    }

    /** إعادة تعيين النموذج */
    function resetForm() {
        taskForm.reset();
        editIdInput.value = '';
        submitBtn.textContent = '➕ إضافة مهمة';
        submitBtn.style.background = 'var(--accent)';
        taskTitleInput.focus();
    }

    /** بدء تعديل مهمة */
    function startEdit(task) {
        editIdInput.value = task.id;
        taskTitleInput.value = task.title;
        taskDueDateInput.value = task.dueDate || '';
        taskPrioritySelect.value = task.priority;
        submitBtn.textContent = '✏️ تحديث المهمة';
        submitBtn.style.background = '#7c3aed';
        taskTitleInput.focus();
        // التمرير للأعلى للنموذج
        taskForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /** حذف مهمة */
    function deleteTask(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) {
            showToast('❌ المهمة غير موجودة.', 'error');
            renderTasks();
            return;
        }
        // تأكيد بسيط للمهام غير المكتملة عالية الأولوية
        if (task.priority === 'high' && !task.completed) {
            if (!confirm('⚠️ هذه المهمة عالية الأولوية. هل أنت متأكد من حذفها؟')) {
                return;
            }
        }
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        // إذا كنا في وضع تعديل لهذه المهمة، نعيد تعيين النموذج
        if (editIdInput.value === id) {
            resetForm();
        }
        renderTasks();
        showToast('🗑️ تم حذف المهمة', 'info');
    }

    /** تبديل حالة الإكمال */
    function toggleComplete(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) {
            showToast('❌ المهمة غير موجودة.', 'error');
            renderTasks();
            return;
        }
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
        if (task.completed) {
            showToast('🎯 أحسنت! مهمة مكتملة', 'success');
        }
    }

    // ============ إشعارات المتصفح ============
    function requestNotificationPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }

    /** إرسال إشعار للمهام العالية الأولوية القريبة (تُستدعى عند التحميل) */
    function checkUpcomingUrgentTasks() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const urgentUpcoming = tasks.filter(t => {
            if (t.completed || t.priority !== 'high' || !t.dueDate) return false;
            const due = new Date(t.dueDate + 'T00:00:00');
            return due >= today && due <= tomorrow;
        });

        urgentUpcoming.forEach(t => {
            try {
                new Notification('⚠️ مهمة عالية الأولوية تقترب', {
                    body: `"${t.title}" - ${formatDate(t.dueDate)}`,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">🔴</text></svg>',
                    tag: t.id,
                });
            } catch (e) {
                // تجاهل أخطاء الإشعارات
            }
        });
    }

    // ============ مستمعي الأحداث ============

    // إرسال النموذج
    taskForm.addEventListener('submit', saveTask);

    // زر الإلغاء المخفي (عند الضغط على Escape أثناء التعديل)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editIdInput.value) {
            resetForm();
            showToast('↩️ تم إلغاء التعديل', 'info');
        }
    });

    // البحث
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        renderTasks();
    });

    // أزرار الفلترة
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter');
            renderTasks();
        });
    });

    // طلب الإذن عند أول تفاعل
    document.body.addEventListener('click', requestNotificationPermission, { once: true });

    // ============ بدء التشغيل ============
    function init() {
        loadTasks();
        renderTasks();
        resetForm();
        requestNotificationPermission();
        // فحص المهام العاجلة بعد تحميل الصفحة
        setTimeout(checkUpcomingUrgentTasks, 2000);
        // فحص دوري كل 10 دقائق
        setInterval(checkUpcomingUrgentTasks, 10 * 60 * 1000);

        console.log('✅ TaskFlow Pro جاهز | عدد المهام المحملة:', tasks.length);
    }

    // تشغيل التطبيق
    init();

    // تعريض بعض الدوال للفحص في وضع التطوير فقط (اختياري)
    if (typeof window !== 'undefined') {
        window.__taskFlow = {
            getTasks: () => tasks,
            resetAll: () => {
                if (confirm('⚠️ هل أنت متأكد من حذف جميع المهام نهائياً؟')) {
                    tasks = [];
                    saveTasks();
                    resetForm();
                    renderTasks();
                    showToast('🗑️ تم حذف جميع المهام', 'info');
                }
            },
        };
    }
})();