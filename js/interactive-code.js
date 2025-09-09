document.addEventListener('DOMContentLoaded', () => {
    // First, find and set up all interactive code blocks
    const codeBlocks = document.querySelectorAll('pre code[class*="language-"]');
    codeBlocks.forEach((codeBlock, index) => {
        const rawCode = codeBlock.textContent;
        if (!rawCode.includes('@c_')) {
            return;
        }

        // Add a class to mark this block as managed by our script
        codeBlock.classList.add('interactive-code-managed');

        // Hide original content to avoid flash of unstyled text
        codeBlock.style.opacity = '0';

        const interactiveBlock = new InteractiveCode(codeBlock, rawCode, index);
        interactiveBlock.init();

        // Show after setup
        codeBlock.style.opacity = '1';
    });

    // After setting up interactive blocks, highlight all other non-managed code blocks
    document.querySelectorAll('pre code:not(.interactive-code-managed)').forEach((block) => {
        hljs.highlightElement(block);
    });
});

class InteractiveCode {
    constructor(element, rawCode, index) {
        this.element = element;
        // Normalize line endings BUT DO NOT trim whitespace, it's significant in <pre>
        this.rawCode = rawCode.replace(/\r\n/g, '\n');
        this.blockId = `interactive-code-${index}`;
        this.language = this.getLanguage();
        this.steps = [];
        this.stepTree = null;
        this.currentStepIndex = -1;
        this.isAnimating = false;
        this.fullCodeRendered = false;
        this.nextStepCursorEl = null;

        // Prevent highlight.js from auto-processing this block, as we'll handle it manually.
        this.element.classList.add('hljs');
    }

    init() {
        this.createControls();
        this.parseAndRenderInitialState();
        this.addNextStepCursor(); // Add the initial cursor
    }

    getLanguage() {
        const match = this.element.className.match(/language-(\w+)/);
        return match ? match[1] : 'plaintext';
    }
    
    // --- PARSER AND RENDERER ---
    parseAndRenderInitialState() {
        // 1. Parse raw code into a "dirty" tree structure including all whitespace nodes
        this.stepTree = this.buildStepTree();
        
        // 2. Clean up the tree to remove unwanted whitespace nodes between steps
        this.cleanupStepTree(this.stepTree);

        // 3. Flatten the clean tree into a sequential list of steps for animation
        this.steps = this.flattenTreeForAnimation(this.stepTree);
        
        // 4. Render the initial state with placeholders
        this.element.innerHTML = ''; // Clear original content
        this.stepTree.children.forEach(node => {
            if (node.type === 'base') {
                const span = document.createElement('span');
                span.innerHTML = hljs.highlight(node.content, { language: this.language, ignoreIllegals: true }).value;
                this.element.appendChild(span);
            } else {
                const placeholder = document.createElement('span');
                placeholder.id = node.elementId;
                this.element.appendChild(placeholder);
            }
        });

        this.currentStepIndex = -1;
        this.updateControls();
    }

    buildStepTree() {
        const root = { children: [] };
        const stack = [root];
        const markerRegex = /@c_(start|end)(_empty)?_([_A-Za-z0-9]+)/g;

        let lastIndex = 0;
        let match;

        while (match = markerRegex.exec(this.rawCode)) {
            const [fullMatch, action, empty, id] = match;
            const currentIndex = match.index;
            const parent = stack[stack.length - 1];

            // Add preceding text as a 'base' node without any cleaning logic yet.
            if (currentIndex > lastIndex) {
                parent.children.push({ type: 'base', content: this.rawCode.substring(lastIndex, currentIndex) });
            }

            if (action === 'start') {
                const node = {
                    id,
                    type: empty ? 'empty-step' : 'step',
                    elementId: `${this.blockId}-step-${id}`,
                    children: [],
                    parent,
                    rawStartIndex: currentIndex,
                    rawStartMarker: fullMatch,
                };
                parent.children.push(node);
                stack.push(node);
            } else { // action === 'end'
                parent.rawEndIndex = currentIndex;
                parent.rawEndMarker = fullMatch;
                stack.pop();
            }

            let effectiveEndIndex = currentIndex + fullMatch.length;
            // After an end marker, consume the following newline ONLY IF it's followed
            // by another step start marker. This prevents consuming newlines before regular code.
            if (action === 'end') {
                const remainingStr = this.rawCode.substring(effectiveEndIndex);
                const nextMarkerMatch = remainingStr.match(/^\s*@c_start/);

                if (nextMarkerMatch) {
                    const newlineMatch = remainingStr.match(/^[ \t]*\n/);
                    if (newlineMatch) {
                        effectiveEndIndex += newlineMatch[0].length;
                    }
                }
            }
            lastIndex = effectiveEndIndex;
        }

        // Add any remaining text
        if (lastIndex < this.rawCode.length) {
            root.children.push({ type: 'base', content: this.rawCode.substring(lastIndex) });
        }
        return root;
    }

    cleanupStepTree(node) {
        if (!node.children) return;

        const cleanedChildren = [];
        for (let i = 0; i < node.children.length; i++) {
            const current = node.children[i];
            const prev = i > 0 ? node.children[i - 1] : null;
            const next = i < node.children.length - 1 ? node.children[i + 1] : null;

            // A node is considered disposable whitespace if it's a 'base' type,
            // contains only whitespace, and is sandwiched between two 'step' or 'empty-step' nodes.
            const isJustWhitespace = current.type === 'base' && current.content.trim() === '';
            const isAfterStep = prev && (prev.type === 'step' || prev.type === 'empty-step');
            const isBeforeStep = next && (next.type === 'step' || next.type === 'empty-step');

            if (isJustWhitespace && isAfterStep && isBeforeStep) {
                continue; // Skip this whitespace node.
            }

            cleanedChildren.push(current);

            // Recurse for children
            if (current.children && current.children.length > 0) {
                this.cleanupStepTree(current);
            }
        }
        node.children = cleanedChildren;
    }

    flattenTreeForAnimation(root) {
        const steps = [];
        function traverse(node) {
            if (node.type === 'step' || node.type === 'empty-step') {
                steps.push(node);
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        }
        traverse(root);
        return steps;
    }
    
    // --- UI CONTROLS ---

    addNextStepCursor() {
        this.removeNextStepCursor(); // Clean up first

        if (this.currentStepIndex >= this.steps.length - 1 || this.fullCodeRendered) {
            return;
        }
        const nextStep = this.steps[this.currentStepIndex + 1];
        let targetElement = document.getElementById(nextStep.elementId);

        if (targetElement) {
            let contentForWhitespace = '';
            if (nextStep.type === 'empty-step') {
                 // For empty step, the content is the shell that gets rendered first.
                 contentForWhitespace = this.getShellContent(nextStep).shellWithPlaceholders;
            } else {
                contentForWhitespace = this.rawCode.substring(nextStep.rawStartIndex + nextStep.rawStartMarker.length, nextStep.rawEndIndex);
            }
           
            const leadingWhitespaceMatch = contentForWhitespace.match(/^(\s*)/);
            const whitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : '';

            const whitespaceNode = document.createTextNode(whitespace);
            
            this.nextStepCursorEl = document.createElement('span');
            this.nextStepCursorEl.className = 'next-step-cursor';

            targetElement.appendChild(whitespaceNode);
            targetElement.appendChild(this.nextStepCursorEl);
        }
    }

    removeNextStepCursor() {
        if (this.nextStepCursorEl) {
            const parent = this.nextStepCursorEl.parentElement;
            if (parent) {
                parent.innerHTML = '';
            }
            this.nextStepCursorEl = null;
        }
    }

    createControls() {
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'interactive-code-controls';

        this.prevButton = document.createElement('button');
        this.prevButton.textContent = 'Назад';
        this.prevButton.onclick = () => this.previousStep();
        
        this.stepCounter = document.createElement('span');
        this.stepCounter.className = 'interactive-code-step-counter';

        this.nextButton = document.createElement('button');
        this.nextButton.textContent = 'Далее';
        this.nextButton.onclick = () => this.nextStep();

        const showAllButton = document.createElement('button');
        showAllButton.textContent = 'Показать полностью';
        showAllButton.onclick = () => this.showAll();

        const resetButton = document.createElement('button');
        resetButton.textContent = 'Сбросить';
        resetButton.onclick = () => this.reset();

        controlsContainer.appendChild(resetButton);
        controlsContainer.appendChild(showAllButton);
        controlsContainer.appendChild(this.prevButton);
        controlsContainer.appendChild(this.stepCounter);
        controlsContainer.appendChild(this.nextButton);

        const preElement = this.element.parentElement;
        const container = document.createElement('div');
        container.className = 'interactive-code-container';

        preElement.parentNode.insertBefore(container, preElement);
        container.appendChild(preElement);
        container.appendChild(controlsContainer);
    }
    
    updateControls() {
        this.prevButton.disabled = this.currentStepIndex < 0 || this.isAnimating || this.fullCodeRendered;
        this.nextButton.disabled = this.currentStepIndex >= this.steps.length - 1 || this.isAnimating || this.fullCodeRendered;
        this.stepCounter.textContent = `${this.currentStepIndex + 1} / ${this.steps.length}`;
    }

    // --- ANIMATION LOGIC ---

    nextStep() {
        if (this.currentStepIndex >= this.steps.length - 1 || this.isAnimating) {
            return;
        }
        this.isAnimating = true; // Set lock
        this.removeNextStepCursor();

        this.currentStepIndex++;
        
        const step = this.steps[this.currentStepIndex];
        const targetElement = document.getElementById(step.elementId);
        
        this.updateControls(); // Update counters immediately

        const onStepComplete = () => {
            this.isAnimating = false;
            this.updateControls();
            this.addNextStepCursor();
            this.ensureCodeVisible();
        };

        if (step.type === 'step') {
            const contentToType = this.rawCode.substring(step.rawStartIndex + step.rawStartMarker.length, step.rawEndIndex);
            this.typewriter(targetElement, contentToType, onStepComplete);

        } else if (step.type === 'empty-step') {
            const { shellWithPlaceholders } = this.getShellContent(step);
            
            // For empty steps, we animate the shell text, then swap in the real HTML with placeholders
            const shellText = shellWithPlaceholders.replace(/<span id=".*?"><\/span>/g, '');
            
            this.typewriter(targetElement, shellText, () => {
                // After typing, replace with the HTML structure including placeholders
                targetElement.innerHTML = shellWithPlaceholders;
                
                // Re-highlight carefully, only text nodes, preserving placeholders
                const childNodes = Array.from(targetElement.childNodes);
                targetElement.innerHTML = ''; // Clear for rebuild

                childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const highlighted = hljs.highlight(node.textContent, { language: this.language, ignoreIllegals: true }).value;
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = highlighted;
                        Array.from(tempDiv.childNodes).forEach(hn => targetElement.appendChild(hn.cloneNode(true)));
                    } else {
                        targetElement.appendChild(node.cloneNode(true)); // Append the <span> placeholders
                    }
                });

                onStepComplete();
            });
        }
    }

    ensureCodeVisible() {
        const preElement = this.element.parentElement;
        if (!preElement) return;

        const preRect = preElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const buffer = 20; 

        if (preRect.bottom > viewportHeight - buffer) {
            preElement.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
        }
    }

    getShellContent(stepNode) {
        let shellWithPlaceholders = '';
        stepNode.children.forEach(child => {
            if (child.type === 'base') {
                shellWithPlaceholders += child.content;
            } else if (child.type === 'step' || child.type === 'empty-step') {
                shellWithPlaceholders += `<span id="${child.elementId}"></span>`;
            }
        });
        return { shellWithPlaceholders };
    }

    previousStep() {
        if (this.currentStepIndex < 0 || this.isAnimating) {
            return;
        }
        
        const step = this.steps[this.currentStepIndex];
        const targetElement = document.getElementById(step.elementId);
        targetElement.innerHTML = '';
        
        this.currentStepIndex--;
        this.updateControls();
        this.addNextStepCursor();
    }

    reset() {
        this.isAnimating = false;
        this.fullCodeRendered = false;
        this.removeNextStepCursor();
        this.parseAndRenderInitialState();
        this.addNextStepCursor();
    }

    showAll() {
        this.fullCodeRendered = true;
        this.isAnimating = false;
        this.removeNextStepCursor();

        let finalCode = '';
        const buildFinalCode = (nodes) => {
            nodes.forEach(node => {
                if (node.type === 'base') {
                    finalCode += node.content;
                } else if (node.type === 'step' || node.type === 'empty-step') {
                    // For showing all, we need the full content, including children's markers.
                    const content = this.rawCode.substring(node.rawStartIndex + node.rawStartMarker.length, node.rawEndIndex);
                    finalCode += content;
                }
            });
        };

        buildFinalCode(this.stepTree.children);

        // After building the string from the tree, we still need to strip all markers from the result.
        const markerRegex = /@c_(start|end)(_empty)?_([_A-Za-z0-9]+)/g;
        finalCode = finalCode.replace(markerRegex, '');

        this.element.innerHTML = hljs.highlight(finalCode, { language: this.language, ignoreIllegals: true }).value;
        this.currentStepIndex = this.steps.length - 1;
        this.updateControls();
    }

    typewriter(element, text, callback) {
        let i = 0;
        element.innerHTML = '';
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        element.appendChild(cursor);

        const typing = () => {
            if (i < text.length) {
                const charNode = document.createTextNode(text.charAt(i));
                element.insertBefore(charNode, cursor);
                i++;
                setTimeout(typing, 10); // typing speed
            } else {
                element.removeChild(cursor);
                
                // Highlight the final typed text.
                element.innerHTML = hljs.highlight(text, { language: this.language, ignoreIllegals: true }).value;

                if (callback) {
                    callback();
                }
            }
        };
        typing();
    }
}
