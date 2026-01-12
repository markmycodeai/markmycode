/**
 * Student Practice Module - LeetCode-style interface
 * Three-phase flow: Topic Selection → Question Selection → Code Editor with Problem Solving
 * CRITICAL: Student MUST select topic AND question before accessing code editor
 */

const StudentPractice = {
    // State
    topics: [],
    selectedTopic: null,
    questions: [],
    selectedQuestion: null,
    notes: [],
    currentLanguage: 'python',
    code: '',
    results: null,
    customTestCases: [],  // Array of {input, expected_output}

    // Phase tracking
    currentPhase: 'topics', // 'topics', 'questions', or 'editor'

    // API Endpoints
    topicsEndpoint: `${CONFIG.API_BASE_URL}/student/topics`,
    questionsEndpoint: `${CONFIG.API_BASE_URL}/student/questions`,
    notesEndpoint: `${CONFIG.API_BASE_URL}/student/notes`,

    /**
     * Load student practice page
     * Validates hierarchy and shows topic selection phase
     */
    async load() {
        try {
            const user = Auth.getCurrentUser();

            // Display hierarchy for debugging
            console.log('🔍 Student hierarchy:', {
                college_id: user.college_id,
                department_id: user.department_id,
                batch_id: user.batch_id,
                student_id: user.student_id
            });

            document.getElementById('collegeDisplay').textContent = user.college_id || 'NOT SET';
            document.getElementById('departmentDisplay').textContent = user.department_id || 'NOT SET';
            document.getElementById('batchDisplay').textContent = user.batch_id || 'NOT SET';
            document.getElementById('studentIdDisplay').textContent = user.student_id || 'NOT SET';

            // CRITICAL GUARD: Student must have complete hierarchy
            if (!user.college_id || !user.department_id || !user.batch_id) {
                const missingFields = [];
                if (!user.college_id) missingFields.push("college");
                if (!user.department_id) missingFields.push("department");
                if (!user.batch_id) missingFields.push("batch");

                const message = `Your student account is incomplete. Missing: ${missingFields.join(', ')}. ` +
                    `Please contact your department administrator to complete your profile.`;
                Utils.showMessage('practiceMessage', message, 'error');
                console.error('Student hierarchy incomplete:', { college_id: user.college_id, department_id: user.department_id, batch_id: user.batch_id });
                return;
            }

            // Hierarchy complete - load topics and notes
            this.loadTopics(); // Async but we don't block
            this.loadNotes();
            this.fetchProfile(); // Fetch names for header
            this.showPhase('topics');

            // Handle window resize for Monaco
            window.addEventListener('resize', () => {
                if (this.monacoInstance) this.monacoInstance.layout();
            });
        } catch (error) {
            console.error('Student practice load error:', error);
            Utils.showMessage('practiceMessage', 'Failed to load practice topics', 'error');
        }
    },

    /**
     * Fetch student profile to get resolved names
     */
    async fetchProfile() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/student/profile`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                const student = data.data?.student || data.student;
                if (student) {
                    if (student.college_name) document.getElementById('collegeDisplay').textContent = student.college_name;
                    if (student.department_name) document.getElementById('departmentDisplay').textContent = student.department_name;
                    if (student.batch_name) document.getElementById('batchDisplay').textContent = student.batch_name;
                }
            }
        } catch (e) {
            console.warn('Failed to fetch profile names', e);
        }
    },

    /**
     * Load all topics for student's batch
     */
    async loadTopics() {
        const token = localStorage.getItem('token');

        console.log('🔍 Loading topics...');
        console.log('Token:', token ? 'Present' : 'MISSING');
        console.log('Endpoint:', this.topicsEndpoint);
        console.log('this (StudentPractice object):', this);

        try {
            const response = await fetch(this.topicsEndpoint, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (response.ok) {
                const data = await response.json();
                this.topics = data.data?.topics || data.topics || [];
                this.renderTopics();
            } else {
                const errorData = await response.json();
                console.error('Load topics error:', response.status, errorData);
                Utils.showMessage('practiceMessage', `Failed to load topics: ${errorData.message || response.status}`, 'error');
            }
        } catch (error) {
            console.error('Load topics error:', error);
            console.error('Error message:', error.message);
            Utils.showMessage('practiceMessage', `Failed to load topics: ${error.message}`, 'error');
        }
    },

    /**
     * Load all notes for student's batch
     */
    async loadNotes() {
        try {
            const response = await fetch(this.notesEndpoint, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.notes = data.data?.notes || data.notes || [];
                this.renderNotes();
            } else {
                console.error('Load notes error:', response.status);
            }
        } catch (error) {
            console.error('Load notes error:', error);
        }
    },

    /**
     * Render notes in notes section
     */
    renderNotes() {
        const container = document.getElementById('studentNotesList');
        if (!container) return;

        if (!this.notes || this.notes.length === 0) {
            container.innerHTML = '<div style="padding: 1rem; color: #999; text-align: center;">No notes available</div>';
            return;
        }

        container.style.marginTop = '2rem';

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                ${this.notes.map(note => `
                    <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--bg-surface); transition: transform 0.2s, box-shadow 0.2s; box-shadow: var(--shadow-sm);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="width: 40px; height: 40px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary-500);">
                                <i class="fas fa-book"></i>
                            </div>
                        </div>
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text-main); font-size: 1.1rem;">${this.escapeHtml(note.title)}</h4>
                        <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted); margin-top: auto;">
                            ${note.drive_link ? `<a href="${this.escapeHtml(note.drive_link)}" target="_blank" class="btn btn-sm btn-outline" style="width: 100%; display: block; text-align: center;">Open Resource</a>` : '<span style="color: var(--text-subtle);">No link provided</span>'}
                        </p>
                    </div>
                `).join('')}
            </div>
        `;

        // Add hover effects via JS or assume CSS handles .card hover
        container.querySelectorAll('.card').forEach(card => {
            card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = 'var(--shadow-md)'; });
            card.addEventListener('mouseleave', () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = 'var(--shadow-sm)'; });
        });
    },

    /**
     * Render topics in left sidebar (Phase 1)
     */
    renderTopics() {
        const container = document.getElementById('studentTopicsList');

        if (!container) {
            console.error('ERROR: studentTopicsList container not found!');
            return;
        }

        try {
            console.log('Topics to render:', this.topics);
            console.log('Topics count:', this.topics?.length || 0);

            if (!this.topics || this.topics.length === 0) {
                container.innerHTML = '<div style="padding: 1rem; color: #999; text-align: center;">No topics available</div>';
                return;
            }

            const html = `<div class="topic-grid">` + this.topics.map(topic => {
                const topicName = topic.topic_name || topic.name || 'Untitled Topic';
                // Active state styling if selected
                const isActive = this.selectedTopic?.id === topic.id;
                const activeStyle = isActive ? 'border-color: var(--primary); transform: translateY(-5px); box-shadow: var(--shadow-xl);' : '';

                return `
                    <div class="topic-card" style="${activeStyle}" onclick="StudentPractice.selectTopic('${topic.id}')">
                        <h4>${Utils.escapeHtml(topicName)}</h4>
                        <p>Click to view questions</p>
                    </div>
                `;
            }).join('') + `</div>`;
            container.innerHTML = html;
            console.log('Topics rendered successfully');
        } catch (error) {
            console.error('ERROR in renderTopics:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            container.innerHTML = '<div style="padding: 1rem; color: red; text-align: center;">Error rendering topics</div>';
        }
    },

    /**
     * Select a topic and load its questions (transition to Phase 2)
     */
    async selectTopic(topicId) {
        try {
            // Find the topic object
            this.selectedTopic = this.topics.find(t => t.id === topicId);
            if (!this.selectedTopic) {
                throw new Error('Topic not found');
            }

            // Load questions for this topic using correct endpoint
            const response = await fetch(`${this.questionsEndpoint}/by-topic/${topicId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.questions = data.data?.questions || data.questions || [];
            } else {
                throw new Error('Failed to load questions');
            }

            // Reset question selection and code
            this.selectedQuestion = null;
            this.code = '';
            this.results = null;
            this.currentLanguage = 'python';

            // Update UI - highlight selected topic and show questions
            this.renderTopics();
            this.renderQuestions();
            this.showPhase('questions');

        } catch (error) {
            console.error('Select topic error:', error);
            Utils.showMessage('practiceMessage', 'Failed to load questions for this topic', 'error');
        }
    },

    /**
     * Render questions for selected topic in middle panel (Phase 2)
     */
    renderQuestions() {
        const container = document.getElementById('studentQuestionsList');
        if (!container) return;

        if (!this.questions || this.questions.length === 0) {
            container.innerHTML = '<div style="padding: 1rem; color: #999; text-align: center;">No questions in this topic</div>';
            return;
        }

        container.innerHTML = `<div class="question-list">` + this.questions.map(question => `
            <div class="question-card" onclick="StudentPractice.selectQuestion('${question.id}')">
                <div>
                    <h4 style="margin: 0; margin-bottom: 0.5rem; font-size: 1.1rem; color: var(--text-main);">${Utils.escapeHtml(question.title || question.question_title)}</h4>
                    <span class="badge" style="background: ${this.getDifficultyColor(question.difficulty)}; color: white;">
                        ${question.difficulty || 'Medium'}
                    </span>
                </div>
                <div style="color: var(--primary);">
                    Solve &rarr;
                </div>
            </div>
        `).join('') + `</div>`;
    },

    /**
     * Select a question and show code editor (transition to Phase 3)
     */
    async selectQuestion(questionId) {
        try {
            // Fetch full question details
            const response = await fetch(`${this.questionsEndpoint}/${questionId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            console.log('📝 selectQuestion response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('📝 selectQuestion raw data:', data);
                console.log('📝 data.data:', data.data);
                console.log('📝 data.question:', data.question);

                this.selectedQuestion = data.data?.question || data.question || {};
                console.log('📝 this.selectedQuestion:', this.selectedQuestion);
                console.log('📝 this.selectedQuestion.id:', this.selectedQuestion?.id);
            } else {
                throw new Error('Failed to load question details');
            }

            if (!this.selectedQuestion || !this.selectedQuestion.id) {
                console.error('❌ selectedQuestion validation failed:', this.selectedQuestion);
                throw new Error('Question details not found');
            }

            // Reset code and results
            this.code = '';
            this.results = null;
            this.currentLanguage = 'python';
            this.customTestCases = [];  // Reset custom test cases for new question

            // Update UI and show editor
            this.renderQuestions();
            this.renderEditor();
            this.showPhase('editor');

            // Initialize button visibility
            const runBtn = document.getElementById('runBtn');
            const submitBtn = document.getElementById('submitBtn');
            const analyzeEfficiencyBtn = document.getElementById('analyzeEfficiencyBtn');

            if (runBtn) runBtn.style.display = 'inline-block';
            if (submitBtn) submitBtn.style.display = 'inline-block';
            if (analyzeEfficiencyBtn) analyzeEfficiencyBtn.style.display = 'none';  // Hidden until correct submission

        } catch (error) {
            console.error('Select question error:', error);
            Utils.showMessage('practiceMessage', 'Failed to load question details', 'error');
        }
    },

    /**
     * Render LeetCode-style code editor and problem statement (Phase 3)
     */
    renderEditor() {
        if (!this.selectedQuestion) return;

        const q = this.selectedQuestion;

        // Update header
        document.getElementById('problemTitle').textContent = Utils.escapeHtml(q.title || q.question_title);
        // Display Topic here as requested
        const topicName = this.selectedTopic?.name || this.selectedTopic?.topic_name || this.selectedQuestion.topic_name || 'N/A';

        document.getElementById('problemDifficulty').innerHTML = `
            <span class="badge" style="background: ${this.getDifficultyColor(q.difficulty)}; color: white; margin-right: 10px;">${q.difficulty || 'Medium'}</span>
            <span style="color: var(--text-muted); font-size: 0.9rem;">Topic: <strong style="color: var(--text-main);">${Utils.escapeHtml(topicName)}</strong></span>
        `;

        // Update problem statement (left panel)
        document.getElementById('problemDescription').innerHTML = Utils.escapeHtml(q.description || 'No description available');

        // Update example input/output
        document.getElementById('exampleInput').textContent = q.sample_input || q.example_input || 'N/A';
        document.getElementById('exampleOutput').textContent = q.sample_output || q.example_output || 'N/A';

        // Show/hide constraints section
        const constraintsSection = document.getElementById('constraintsSection');
        if (q.constraints) {
            document.getElementById('constraints').innerHTML = Utils.escapeHtml(q.constraints);
            constraintsSection.style.display = 'block';
        } else {
            constraintsSection.style.display = 'none';
        }

        // Initialize Monaco Editor
        this.initMonacoEditor(q);

        // Show/hide Run and Submit buttons
        document.getElementById('runBtn').style.display = 'block';
        document.getElementById('submitBtn').style.display = 'block';

        // Show problem and editor sections
        document.getElementById('problemSection').style.display = 'flex';
        document.getElementById('editorSection').style.display = 'flex';
    },

    /**
     * Initialize Monaco Editor
     */
    initMonacoEditor(question) {
        const container = document.getElementById('editorContainer');
        if (!container) return;

        // If code is empty, set default
        if (!this.code) {
            this.code = this.getDefaultTemplate(this.currentLanguage, question.function_name);
        }

        const init = () => {
            // Hide textarea if it exists
            const textarea = document.getElementById('codeEditor');
            if (textarea) textarea.style.display = 'none';

            // Create or update Monaco instance
            let monacoDiv = document.getElementById('monacoEditor');
            if (!monacoDiv) {
                monacoDiv = document.createElement('div');
                monacoDiv.id = 'monacoEditor';
                monacoDiv.style.width = '100%';
                monacoDiv.style.height = '100%'; // use 100% of container 
                monacoDiv.style.minHeight = '500px';
                monacoDiv.style.border = '1px solid var(--border-subtle)';
                container.appendChild(monacoDiv);
            }

            if (this.monacoInstance) {
                const model = this.monacoInstance.getModel();
                this.monacoInstance.setValue(this.code);
                monaco.editor.setModelLanguage(model, this.currentLanguage);
            } else {
                this.monacoInstance = monaco.editor.create(monacoDiv, {
                    value: this.code,
                    language: this.currentLanguage,
                    theme: 'vs-dark',
                    minimap: { enabled: false },
                    automaticLayout: true,
                    fontSize: 14,
                    scrollBeyondLastLine: false,
                    roundedSelection: false,
                });

                this.monacoInstance.onDidChangeModelContent(() => {
                    this.code = this.monacoInstance.getValue();
                    const ta = document.getElementById('codeEditor');
                    if (ta) ta.value = this.code;
                });
            }
        };

        if (window.monaco) {
            init();
        } else if (window.require) {
            console.log('Monaco not ready, waiting for require...');
            window.require(['vs/editor/editor.main'], () => {
                init();
            });
        } else {
            // Fallback
            const textarea = document.getElementById('codeEditor');
            if (textarea) {
                textarea.style.display = 'block';
                textarea.value = this.code;
            }
        }
    },

    /**
     * Change programming language
     */
    changeLanguage(language) {
        this.currentLanguage = language;
        const editor = document.getElementById('codeEditor');
        if (editor) {
            // Confirm data loss if code exists and is not default
            // For now, just simplistic check or force update if user changes language
            // Better UX: Don't check for trimming, just update if it's vastly different or if user wants to.
            // But to keep it simple as requested:
            editor.value = this.getDefaultTemplate(language, this.selectedQuestion?.function_name);
            this.code = editor.value; // Sync state
        }
    },

    /**
     * Get default code template for language
     */
    getDefaultTemplate(language, functionName = 'solve') {
        const templates = {
            python: `def ${functionName}(input_str):
    # Write your solution here
    pass
`,
            javascript: `function ${functionName}(inputStr) {
    // Write your solution here
    
}
`,
            java: `public class Solution {
    public static String ${functionName}(String inputStr) {
        // Write your solution here
        return "";
    }
}
`,
            c: `#include <stdio.h>
#include <string.h>

char* ${functionName}(char* input_str) {
    // Write your solution here
    return "";
}

int main() {
    return 0;
}
`,
            cpp: `#include <bits/stdc++.h>
using namespace std;

string ${functionName}(string input_str) {
    // Write your solution here
    return "";
}

int main() {
    return 0;
}
`
        };
        return templates[language] || templates.python;
    },

    /**
     * Switch Console Tabs (Testcase vs Result)
     */
    switchConsoleTab(tabName) {
        const tabTestcase = document.getElementById('tabTestcase');
        const tabResult = document.getElementById('tabResult');
        const viewTestcase = document.getElementById('viewTestcase');
        const viewResult = document.getElementById('viewResult');

        if (!tabTestcase || !tabResult || !viewTestcase || !viewResult) return;

        if (tabName === 'testcase') {
            tabTestcase.classList.add('active');
            tabResult.classList.remove('active');
            viewTestcase.style.display = 'block';
            viewResult.style.display = 'none';
        } else {
            tabTestcase.classList.remove('active');
            tabResult.classList.add('active');
            viewTestcase.style.display = 'none';
            viewResult.style.display = 'block';
        }
    },

    /**
     * Switch Problem Tabs (Description vs Submissions)
     */
    switchProblemTab(tabName) {
        const tabDescription = document.getElementById('tabDescription');
        const tabSubmissions = document.getElementById('tabSubmissions');
        const descriptionContent = document.getElementById('descriptionContent');
        const submissionsContent = document.getElementById('submissionsContent');

        if (!tabDescription || !tabSubmissions || !descriptionContent || !submissionsContent) return;

        if (tabName === 'description') {
            tabDescription.classList.add('active');
            tabSubmissions.classList.remove('active');
            descriptionContent.style.display = 'block';
            submissionsContent.style.display = 'none';
        } else {
            tabDescription.classList.remove('active');
            tabSubmissions.classList.add('active');
            descriptionContent.style.display = 'none';
            submissionsContent.style.display = 'block';
        }
    },

    /**
     * Add a custom test case
     */
    addCustomTestCase() {
        const customInput = document.getElementById('customInput');
        const customOutput = document.getElementById('customOutput');

        // ... validation ...
        if (!customInput || !customOutput) return;
        const input = customInput.value.trim();
        const output = customOutput.value.trim();

        if (!input) { // Output is optional for simple run
            Utils.showMessage('practiceMessage', 'Input is required', 'error');
            return;
        }

        // Add to custom test cases
        this.customTestCases.push({ input, output });

        // Clear inputs
        customInput.value = '';
        customOutput.value = '';

        // Render custom test cases list
        this.renderCustomTestCases();
        Utils.showMessage('practiceMessage', 'Test case added', 'success');
    },

    /**
     * Render list of custom test cases
     */
    renderCustomTestCases() {
        const container = document.getElementById('customTestCasesList');
        if (!container) return;

        if (this.customTestCases.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        let html = '';

        this.customTestCases.forEach((tc, index) => {
            html += `<div style="background: #2d2d2d; padding: 0.5rem; border-radius: 4px; border: 1px solid #444; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.8rem; color: #ccc;">
                    <span style="color: #888;">Input:</span> ${Utils.escapeHtml(tc.input).substring(0, 20)}...
                </div>
                <button onclick="StudentPractice.removeCustomTestCase(${index})" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 0.8rem;">✕</button>
            </div>`;
        });

        container.innerHTML = html;
    },

    /**
     * Remove a custom test case
     */
    removeCustomTestCase(index) {
        this.customTestCases.splice(index, 1);
        this.renderCustomTestCases();
    },

    /**
     * Run code with sample test case (Compiler Agent)
     */
    async runCode() {
        this.switchConsoleTab('result'); // Auto-switch to result tab

        const editor = document.getElementById('codeEditor');
        if (!editor) return;

        this.code = editor.value;
        if (!this.code.trim()) {
            document.getElementById('testResults').innerHTML = '<div style="padding: 2rem; text-align: center; color: #f87171;">Please write some code first</div>';
            return;
        }

        if (!this.selectedQuestion) return;

        try {
            const runBtn = document.getElementById('runBtn');
            if (runBtn) runBtn.disabled = true;

            document.getElementById('testResults').innerHTML = '<div style="padding: 2rem; text-align: center; color: #aaa;">Running code...</div>';

            // Collect all test cases (sample + custom)
            const testCases = [];

            // Add sample test case
            if (this.selectedQuestion.sample_input) {
                testCases.push({
                    name: 'Sample Test',
                    input: this.selectedQuestion.sample_input,
                    expected: this.selectedQuestion.sample_output || '',
                    is_sample: true
                });
            }

            // Add custom test cases
            this.customTestCases.forEach((tc, index) => {
                testCases.push({
                    name: `Custom Test ${index + 1}`,
                    input: tc.input,
                    expected: tc.output,
                    is_sample: false
                });
            });

            // Run code against all test cases
            const results = [];
            for (const tc of testCases) {
                const response = await fetch(`${CONFIG.API_BASE_URL}/student/run`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        question_id: this.selectedQuestion.id,
                        code: this.code,
                        language: this.currentLanguage,
                        test_input: tc.input
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    results.push({
                        name: tc.name,
                        input: tc.input,
                        expected: tc.expected,
                        is_sample: tc.is_sample,
                        output: null,
                        error: data.message || 'Execution failed',
                        execution_time: 0
                    });
                } else {
                    results.push({
                        name: tc.name,
                        input: tc.input,
                        expected: tc.expected,
                        is_sample: tc.is_sample,
                        output: data.data?.output || '',
                        error: data.data?.error || null,
                        execution_time: data.data?.execution_time || 0
                    });
                }
            }

            this.results = {
                type: 'run',
                test_results: results
            };

            this.renderResults();

        } catch (error) {
            console.error('Run code error:', error);
            document.getElementById('testResults').innerHTML = `<div style="padding: 1rem; color: #f87171;">Execution failed: ${error.message}</div>`;
        } finally {
            const runBtn = document.getElementById('runBtn');
            if (runBtn) runBtn.disabled = false;
        }
    },

    /**
     * Submit code for full evaluation (Evaluator + Efficiency Agents)
     */
    async submitCode() {
        const editor = document.getElementById('codeEditor');
        if (!editor) {
            Utils.showMessage('practiceMessage', 'Code editor not found', 'error');
            return;
        }

        this.code = editor.value;
        if (!this.code.trim()) {
            Utils.showMessage('practiceMessage', 'Please write some code first', 'error');
            return;
        }

        if (!this.selectedQuestion) {
            Utils.showMessage('practiceMessage', 'No question selected', 'error');
            return;
        }

        try {
            const submitBtn = document.getElementById('submitBtn');
            const efficiencyBtn = document.getElementById('analyzeEfficiencyBtn');
            if (submitBtn) submitBtn.disabled = true;
            if (efficiencyBtn) efficiencyBtn.disabled = true;

            Utils.showMessage('practiceMessage', 'Evaluating your solution...', 'info');

            const response = await fetch(`${CONFIG.API_BASE_URL}/student/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    question_id: this.selectedQuestion.id,
                    code: this.code,
                    language: this.currentLanguage
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Code evaluation failed');
            }

            this.results = {
                type: 'submit',
                status: data.data?.status || 'incorrect',
                is_correct: data.data?.status === 'correct',
                test_results: data.data?.test_results || {},
                efficiency_feedback: null,  // Don't show efficiency feedback until button clicked
                performance_id: data.data?.performance_id || null
            };

            this.renderResults();

            if (this.results.is_correct) {
                Utils.showMessage('practiceMessage', 'Correct! All test cases passed!', 'success');
                // Show Analyze Efficiency button only if code is correct
                const efficiencyBtn = document.getElementById('analyzeEfficiencyBtn');
                if (efficiencyBtn) efficiencyBtn.style.display = 'inline-block';
            } else {
                Utils.showMessage('practiceMessage', 'Incorrect solution. Review the test results.', 'error');
                // Hide Analyze Efficiency button if code is incorrect
                const efficiencyBtn = document.getElementById('analyzeEfficiencyBtn');
                if (efficiencyBtn) efficiencyBtn.style.display = 'none';
            }

        } catch (error) {
            console.error('Submit code error:', error);
            Utils.showMessage('practiceMessage', 'Submission failed: ' + error.message, 'error');
        } finally {
            const submitBtn = document.getElementById('submitBtn');
            const efficiencyBtn = document.getElementById('analyzeEfficiencyBtn');
            if (submitBtn) submitBtn.disabled = false;
            if (efficiencyBtn && efficiencyBtn.style.display === 'inline-block') efficiencyBtn.disabled = false;
        }
    },

    /**
     * Analyze efficiency of correct solution
     */
    async analyzeEfficiency() {
        if (!this.results || !this.results.is_correct) {
            Utils.showMessage('practiceMessage', 'Please submit a correct solution first', 'error');
            return;
        }

        if (!this.selectedQuestion) {
            Utils.showMessage('practiceMessage', 'No question selected', 'error');
            return;
        }

        try {
            const efficiencyBtn = document.getElementById('analyzeEfficiencyBtn');
            if (efficiencyBtn) efficiencyBtn.disabled = true;

            Utils.showMessage('practiceMessage', 'Analyzing code efficiency...', 'info');

            const response = await fetch(`${CONFIG.API_BASE_URL}/student/efficiency`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    question_id: this.selectedQuestion.id,
                    code: this.code,
                    language: this.currentLanguage
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Efficiency analysis failed');
            }

            this.results.efficiency_feedback = data.data;
            this.renderResults();
            Utils.showMessage('practiceMessage', 'Efficiency analysis complete', 'success');

        } catch (error) {
            console.error('Efficiency analysis error:', error);
            Utils.showMessage('practiceMessage', 'Efficiency analysis failed: ' + error.message, 'error');
        } finally {
            const efficiencyBtn = document.getElementById('analyzeEfficiencyBtn');
            if (efficiencyBtn) efficiencyBtn.disabled = false;
        }
    },

    /**
     * Render test results in results section - matching prototype design
     */
    renderResults() {
        const testResultsContainer = document.getElementById('testResults');
        const submissionsContainer = document.getElementById('submissionsContent');

        if (!this.results) return;

        const r = this.results;
        let html = '';

        // For RUN type: Show only output in RIGHT panel (Test Results)
        if (r.type === 'run') {
            if (!testResultsContainer) return;

            if (!r.test_results || r.test_results.length === 0) {
                html = '<div style="color: #ccc;">No test results available</div>';
            } else {
                // Display each test case result
                r.test_results.forEach((result, index) => {
                    const isSample = result.is_sample;
                    html += `
                        <div style="background: #1e1e1e; color: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #444;">
                            <!-- Test case header -->
                            <div style="margin-bottom: 1rem;">
                                <strong>${Utils.escapeHtml(result.name)}</strong>
                                ${isSample ? '<span style="margin-left: 0.5rem; font-size: 0.85rem; color: #90ee90;">(Sample)</span>' : '<span style="margin-left: 0.5rem; font-size: 0.85rem; color: #87ceeb;">(Custom)</span>'}
                            </div>
                            
                            <!-- Input -->
                            <div style="margin-bottom: 0.75rem;">
                                <div style="font-size: 0.9rem; color: #a0aec0; margin-bottom: 0.25rem;">Input:</div>
                                <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px; max-height: 100px; overflow-y: auto;">
                                    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; color: #e0e0e0; font-size: 0.9rem;">${Utils.escapeHtml(result.input)}</pre>
                                </div>
                            </div>
                            
                            <!-- Show ONLY Error if present, otherwise show Output + Expected -->
                            ${result.error ? `
                                <div style="padding: 0.75rem; background: rgba(248, 113, 113, 0.1); border-left: 3px solid #f87171; border-radius: 4px;">
                                    <div style="font-size: 0.9rem; color: #fca5a5; font-weight: bold; margin-bottom: 0.25rem;">Error:</div>
                                    <div style="color: #fca5a5; font-size: 0.9rem;">${Utils.escapeHtml(result.error)}</div>
                                </div>
                            ` : `
                                <!-- Output -->
                                <div style="margin-bottom: 0.75rem;">
                                    <div style="font-size: 0.9rem; color: #a0aec0; margin-bottom: 0.25rem;">Output:</div>
                                    <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px; max-height: 100px; overflow-y: auto;">
                                        <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; color: #e0e0e0; font-size: 0.9rem;">${Utils.escapeHtml(result.output || '')}</pre>
                                    </div>
                                </div>
                                
                                <!-- Expected Output -->
                                <div>
                                    <div style="font-size: 0.9rem; color: #a0aec0; margin-bottom: 0.25rem;">Expected Output:</div>
                                    <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px; max-height: 100px; overflow-y: auto;">
                                        <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; color: #90ee90; font-size: 0.9rem;">${Utils.escapeHtml(result.expected)}</pre>
                                    </div>
                                </div>
                            `}
                        </div>
                    `;
                });
            }
            testResultsContainer.innerHTML = html;
        }
        // For SUBMIT type: Show status/efficiency in LEFT panel (Submissions Tab)
        else if (r.type === 'submit') {
            if (!submissionsContainer) return;

            // Switch to Submissions tab
            this.switchProblemTab('submissions');

            // Determine status
            let statusClass = 'incorrect';
            let statusText = 'Incorrect';
            let statusColor = '#facc15'; // default yellow for unknown/partial

            if (r.is_correct || r.status === 'correct') {
                statusClass = 'correct';
                statusText = 'Accepted';
                statusColor = '#4ade80'; // Green
            } else if (r.status === 'execution_error' || r.error) {
                statusClass = 'error';
                statusText = 'Error';
                statusColor = '#f87171'; // Red
            }

            html = `
                <div style="padding: 1rem;">
                    <div style="margin-bottom: 1.5rem;">
                        <h2 style="color: ${statusColor}; margin: 0 0 0.5rem 0;">${statusText}</h2>
                        <div style="color: #aaa; font-size: 0.9rem;">Passed: ${r.test_results && r.test_results.is_correct ? 'All test cases' : 'Some test cases'}</div>
                    </div>
            `;

            // Reason / Error
            if (r.test_results && r.test_results.reason) {
                html += `<div style="background: rgba(255, 255, 255, 0.05); padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; color: #e0e0e0;">
                    ${Utils.escapeHtml(r.test_results.reason)}
                </div>`;
            }
            if (r.error) {
                html += `<div style="background: rgba(248, 113, 113, 0.1); padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; color: #fca5a5; border-left: 3px solid #f87171;">
                    ${Utils.escapeHtml(r.error)}
                </div>`;
            }

            // Efficiency Feedback (repurposing logic)
            if (r.efficiency_feedback) {
                const eff = r.efficiency_feedback;
                html += `
                    <div style="background: #333; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 1rem 0; color: #fff;">Efficiency Analysis</h4>
                `;

                if (eff.time_complexity) {
                    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #444;">
                        <span style="color: #aaa;">Time Complexity</span>
                        <strong style="color: #fff;">${Utils.escapeHtml(eff.time_complexity)}</strong>
                    </div>`;
                }
                if (eff.space_complexity) {
                    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #444;">
                        <span style="color: #aaa;">Space Complexity</span>
                        <strong style="color: #fff;">${Utils.escapeHtml(eff.space_complexity)}</strong>
                    </div>`;
                }

                html += `</div>`; // End metrics card

                if (eff.approach_summary || eff.improvement_suggestions || eff.optimal_method) {
                    html += `<div style="background: #333; border-radius: 8px; padding: 1rem;">
                        <h4 style="margin: 0 0 1rem 0; color: #fff;">Insights</h4>
                     `;

                    if (eff.approach_summary) {
                        html += `<div style="margin-bottom: 1rem;">
                            <div style="color: #aaa; font-size: 0.85rem; margin-bottom: 0.25rem;">Your Approach</div>
                            <div style="color: #e0e0e0;">${Utils.escapeHtml(eff.approach_summary)}</div>
                        </div>`;
                    }

                    if (eff.improvement_suggestions) {
                        html += `<div style="margin-bottom: 1rem;">
                            <div style="color: #aaa; font-size: 0.85rem; margin-bottom: 0.25rem;">Suggestions</div>
                            <div style="color: #e0e0e0;">${Utils.escapeHtml(eff.improvement_suggestions)}</div>
                        </div>`;
                    }

                    if (eff.optimal_method) {
                        html += `<div>
                            <div style="color: #aaa; font-size: 0.85rem; margin-bottom: 0.25rem;">Optimal Method</div>
                            <div style="color: #e0e0e0;">${Utils.escapeHtml(eff.optimal_method)}</div>
                        </div>`;
                    }

                    html += `</div>`; // End insights card
                }
            }

            html += `</div>`;
            submissionsContainer.innerHTML = html;
        }
    },

    /**
     * Switch between Practice and Notes tabs
     */
    switchTab(tabName) {
        const practiceTab = document.getElementById('practiceTabContent');
        const notesTab = document.getElementById('notesTabContent');
        // Button selectors mapping to what's in HTML
        const practiceBtn = document.querySelector('button[onclick="StudentPractice.switchTab(\'practice\')"]');
        const notesBtn = document.getElementById('notesTabBtn');

        if (tabName === 'practice') {
            if (practiceTab) practiceTab.style.display = 'block';
            if (notesTab) notesTab.style.display = 'none';
            if (practiceBtn) {
                practiceBtn.style.borderBottomColor = '#007bff';
                practiceBtn.style.color = '#007bff';
            }
            if (notesBtn) {
                notesBtn.style.borderBottomColor = 'transparent';
                notesBtn.style.color = '#666';
            }
        } else if (tabName === 'notes') {
            if (practiceTab) practiceTab.style.display = 'none';
            if (notesTab) notesTab.style.display = 'block';
            if (practiceBtn) {
                practiceBtn.style.borderBottomColor = 'transparent';
                practiceBtn.style.color = '#666';
            }
            if (notesBtn) {
                notesBtn.style.borderBottomColor = '#007bff';
                notesBtn.style.color = '#007bff';
            }
        }
    },

    /**
     * Show/hide phases and update UI visibility
     */
    showPhase(phase) {
        this.currentPhase = phase;

        const panels = {
            'topics': document.getElementById('topicsPhasePanel'),
            'questions': document.getElementById('questionsPhasePanel'),
            'editor': document.getElementById('editorPhasePanel')
        };

        // Hide all panels first
        Object.values(panels).forEach(panel => {
            if (panel) {
                panel.style.display = 'none';
                panel.classList.remove('animate-fade-in');
            }
        });

        // Show selected phase with animation
        const activePanel = panels[phase];
        if (activePanel) {
            activePanel.style.display = 'flex';
            // Force reflow
            void activePanel.offsetWidth;
            activePanel.classList.add('animate-fade-in');
        }
    },

    /**
     * Navigate back to questions from editor
     */
    goBackToQuestions() {
        this.selectedQuestion = null;
        this.code = '';
        this.results = null;
        document.getElementById('problemSection').style.display = 'none';
        document.getElementById('editorSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        this.showPhase('questions');
    },

    /**
     * Navigate back to topics from questions
     */
    goBackToTopics() {
        this.selectedTopic = null;
        this.questions = [];
        this.selectedQuestion = null;
        this.code = '';
        this.results = null;
        this.renderQuestions();
        document.getElementById('problemSection').style.display = 'none';
        document.getElementById('editorSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        this.showPhase('topics');
    },

    /**
     * Get color for difficulty badge
     */
    getDifficultyColor(difficulty) {
        const difficulty_lower = (difficulty || 'medium').toLowerCase();
        if (difficulty_lower === 'easy') return '#28a745';
        if (difficulty_lower === 'medium') return '#ffc107';
        if (difficulty_lower === 'hard') return '#dc3545';
        return '#6c757d';
    },

    /**
     * Escape HTML to prevent XSS
     */
    /**
     * Toggle custom test cases panel visibility
     */
    toggleCustomTestCasesPanel() {
        const panel = document.getElementById('customTestCasesPanel');
        const toggle = document.getElementById('customTestCasesToggle');

        if (panel && toggle) {
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                toggle.textContent = '▼';
            } else {
                panel.style.display = 'none';
                toggle.textContent = '▶';
            }
        }
    },

    /**
     * Toggle results panel visibility (minimize/expand)
     */
    toggleResultsPanel() {
        const resultsSection = document.getElementById('resultsSection');
        const testResults = document.getElementById('testResults');

        if (resultsSection && testResults) {
            if (testResults.style.display === 'none') {
                testResults.style.display = 'block';
            } else {
                testResults.style.display = 'none';
            }
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
};

window.StudentPractice = StudentPractice;
