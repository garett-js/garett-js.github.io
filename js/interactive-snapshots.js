document.addEventListener('DOMContentLoaded', () => {
    // Найти блоки кода со ступенчатыми снапшотами: распознаём по маркеру "// ----- ШАГ"
    const codeBlocks = document.querySelectorAll('pre code[class*="language-"]');
    codeBlocks.forEach((codeBlock, index) => {
        const raw = (codeBlock.textContent || '').replace(/\r\n/g, '\n');
        if (!/^\s*\/\/\s*-{2,}\s*ШАГ/i.test(raw)) {
            return; // не наш формат
        }

        // пометить блок, чтобы его не перехватывали другие скрипты подсветки
        codeBlock.classList.add('interactive-code-managed');
        codeBlock.style.opacity = '0';

        const interactive = new InteractiveSnapshots(codeBlock, raw, index);
        interactive.init();

        codeBlock.style.opacity = '1';
    });
});

class InteractiveSnapshots {
    constructor(element, rawCode, index) {
        this.element = element;
        this.rawCode = rawCode;
        this.blockId = `interactive-snapshots-${index}`;
        this.language = this._getLanguage();
        this.steps = [];
        this.currentStepIndex = 0;
        this.isAnimating = false;
        this.fullCodeRendered = false;
        this.highlightedRange = null;

        // кнопки/счётчик
        this.prevButton = null;
        this.nextButton = null;
        this.stepCounter = null;
    }

    init() {
        this.steps = this._parseSteps(this.rawCode);
        if (this.steps.length === 0) return;
        this._createControls();
        this._renderStep(0, { placeCursorForNext: true });
        this._updateControls();
    }

    _getLanguage() {
        const match = this.element.className.match(/language-(\w+)/);
        return match ? match[1] : 'plaintext';
    }

    // Разбиваем по заголовкам вида: // ----- ШАГ N -----
    _parseSteps(raw) {
        const parts = raw.split(/^[ \t]*\/\/\s*-{2,}\s*ШАГ\s*\d+\s*-{2,}\s*$/gmi)
            .map(s => s.trim())
            .filter(Boolean);
        // Если первый элемент начинается с "import" — это корректные снэпшоты
        return parts;
    }

    _createControls() {
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'interactive-code-controls';

        const resetButton = document.createElement('button');
        resetButton.textContent = 'Сбросить';
        resetButton.onclick = () => this.reset();

        const showAllButton = document.createElement('button');
        showAllButton.textContent = 'Показать полностью';
        showAllButton.onclick = () => this.showAll();

        this.prevButton = document.createElement('button');
        this.prevButton.textContent = 'Назад';
        this.prevButton.onclick = () => this.previousStep();

        this.stepCounter = document.createElement('span');
        this.stepCounter.className = 'interactive-code-step-counter';

        this.nextButton = document.createElement('button');
        this.nextButton.textContent = 'Далее';
        this.nextButton.onclick = () => this.nextStep();

        controlsContainer.appendChild(resetButton);
        controlsContainer.appendChild(showAllButton);
        controlsContainer.appendChild(this.prevButton);
        controlsContainer.appendChild(this.stepCounter);
        controlsContainer.appendChild(this.nextButton);

        const pre = this.element.parentElement; // <pre>
        const container = document.createElement('div');
        container.className = 'interactive-code-container';
        pre.parentNode.insertBefore(container, pre);
        container.appendChild(pre);
        container.appendChild(controlsContainer);
    }

    _updateControls() {
        const total = this.steps.length;
        const idx = this.currentStepIndex;
        this.prevButton.disabled = this.isAnimating || idx <= 0 || this.fullCodeRendered;
        this.nextButton.disabled = this.isAnimating || idx >= total - 1 || this.fullCodeRendered;
        this.stepCounter.textContent = `${idx + 1} / ${total}`;
    }

    // Находим первое расхождение построчно (для курсора)
    _findFirstDiffLine(prevText, nextText) {
        const prevLines = prevText.split('\n');
        const nextLines = nextText.split('\n');
        const minLen = Math.min(prevLines.length, nextLines.length);
        for (let i = 0; i < minLen; i++) {
            if (prevLines[i] !== nextLines[i]) return i;
        }
        return prevLines.length === nextLines.length ? -1 : minLen; // изменение после общего префикса
    }

    // Символьная разница для печати (простая: LCP/LCS)
    _diffAddOnly(prevText, nextText) {
        let i = 0;
        const minLen = Math.min(prevText.length, nextText.length);
        while (i < minLen && prevText[i] === nextText[i]) i++;
        let j = 0;
        const prevRemain = prevText.length - i;
        const nextRemain = nextText.length - i;
        while (j < prevRemain && j < nextRemain && prevText[prevText.length - 1 - j] === nextText[nextText.length - 1 - j]) j++;
        const added = nextText.slice(i, nextText.length - j);
        return { insertAt: i, added };
    }

    _renderHighlighted(text, highlightRange = null) {
        if (!highlightRange || highlightRange.from === highlightRange.to) {
            this.element.innerHTML = hljs.highlight(text, { language: this.language, ignoreIllegals: true }).value;
            return;
        }
        
        const startLine = (text.slice(0, highlightRange.from).match(/\n/g) || []).length;
        const endLine = (text.slice(0, highlightRange.to).match(/\n/g) || []).length;

        const highlightedHtml = hljs.highlight(text, { language: this.language, ignoreIllegals: true }).value;
        const lines = highlightedHtml.split('\n');

        for (let i = startLine; i <= endLine; i++) {
            if (lines[i] !== undefined) {
                // Wrap the entire line content to apply background
                lines[i] = `<span class="newly-typed">${lines[i]}</span>`;
            }
        }
        this.element.innerHTML = lines.join('\n');
    }

    // Символьная разница: индекс первого расхождения
    _findFirstDiffIndex(a, b) {
        const minLen = Math.min(a.length, b.length);
        for (let i = 0; i < minLen; i++) {
            if (a.charAt(i) !== b.charAt(i)) return i;
        }
        return a.length === b.length ? -1 : minLen;
    }

    // Вычисляем позицию курсора с учётом ведущих переносов и отступов нового куска
    _computeCursorPlacement(prevText, nextText) {
        const { insertAt, added } = this._diffAddOnly(prevText, nextText);
        let leadingForCursor = '';
        for (let i = 0; i < added.length; i++) {
            const ch = added[i];
            if (ch === '\n' || ch === ' ' || ch === '\t') leadingForCursor += ch; else break;
        }
        const composite = prevText.slice(0, insertAt) + leadingForCursor;
        const pointerLineIdx = (composite.match(/\n/g) || []).length;
        const lastNl = composite.lastIndexOf('\n');
        const pointerColumn = lastNl === -1 ? composite.length : (composite.length - lastNl - 1);
        let indentAfterLastNewline = 0;
        {
            const parts = leadingForCursor.split('\n');
            const tail = parts.length > 1 ? parts[parts.length - 1] : (leadingForCursor.includes('\n') ? '' : leadingForCursor);
            indentAfterLastNewline = (tail.match(/[ \t]+$/) || [''])[0].length;
        }
        return { pointerLineIdx, pointerColumn, indentAfterLastNewline };
    }

    _renderWithNextCursor(prevText, nextText) {
        const { pointerLineIdx, pointerColumn, indentAfterLastNewline } = this._computeCursorPlacement(prevText, nextText);

        const prevLines = prevText.split('\n');
        const fragment = document.createDocumentFragment();

        for (let idx = 0; idx < prevLines.length; idx++) {
            if (idx > 0) fragment.appendChild(document.createTextNode('\n'));
            const lineText = prevLines[idx];
            const lineSpan = document.createElement('span');
            lineSpan.style.whiteSpace = 'pre';

            if (idx === pointerLineIdx) {
                const col = Math.max(0, Math.min(pointerColumn, lineText.length));
                const left = lineText.slice(0, col);
                const right = lineText.slice(col);

                if (left.length > 0) {
                    const leftSpan = document.createElement('span');
                    leftSpan.innerHTML = hljs.highlight(left, { language: this.language, ignoreIllegals: true }).value;
                    lineSpan.appendChild(leftSpan);
                }

                if (pointerColumn > lineText.length) {
                    const extraSpacesCount = pointerColumn - lineText.length;
                    if (extraSpacesCount > 0) lineSpan.appendChild(document.createTextNode(' '.repeat(extraSpacesCount)));
                }

                const cursor = document.createElement('span');
                cursor.className = 'next-step-cursor';
                lineSpan.appendChild(cursor);

                if (right.length > 0) {
                    const rightSpan = document.createElement('span');
                    rightSpan.innerHTML = hljs.highlight(right, { language: this.language, ignoreIllegals: true }).value;
                    lineSpan.appendChild(rightSpan);
                }
            } else {
                const highlighted = hljs.highlight(lineText, { language: this.language, ignoreIllegals: true }).value;
                const contentSpan = document.createElement('span');
                contentSpan.innerHTML = highlighted.length ? highlighted : '\u200B';
                lineSpan.appendChild(contentSpan);
            }

            fragment.appendChild(lineSpan);
        }

        // Курсор на новой строке после последней исходной
        if (pointerLineIdx >= prevLines.length) {
            fragment.appendChild(document.createTextNode('\n'));
            const newLine = document.createElement('span');
            newLine.style.whiteSpace = 'pre';
            if (indentAfterLastNewline > 0) newLine.appendChild(document.createTextNode(' '.repeat(indentAfterLastNewline)));
            const cursor = document.createElement('span');
            cursor.className = 'next-step-cursor';
            newLine.appendChild(cursor);
            fragment.appendChild(newLine);
        }

        this.element.innerHTML = '';
        this.element.appendChild(fragment);
    }

    // Рендер текущего текста с подсветкой новых строк и курсором следующего шага
    _renderHighlightedWithNextCursor(currentText, nextText, highlightRange = null) {
        const { pointerLineIdx, pointerColumn, indentAfterLastNewline } = this._computeCursorPlacement(currentText, nextText);

        const lines = currentText.split('\n');
        const fragment = document.createDocumentFragment();

        // Определим диапазон строк для подсветки
        let startLine = -1;
        let endLine = -1;
        if (highlightRange && highlightRange.from !== undefined && highlightRange.to !== undefined) {
            startLine = (currentText.slice(0, highlightRange.from).match(/\n/g) || []).length;
            endLine = (currentText.slice(0, highlightRange.to).match(/\n/g) || []).length;
        }

        for (let idx = 0; idx < lines.length; idx++) {
            if (idx > 0) fragment.appendChild(document.createTextNode('\n'));
            const lineText = lines[idx];

            const baseLine = document.createElement('span');
            baseLine.style.whiteSpace = 'pre';

            if (idx === pointerLineIdx) {
                const col = Math.max(0, Math.min(pointerColumn, lineText.length));
                const left = lineText.slice(0, col);
                const right = lineText.slice(col);

                if (left.length > 0) {
                    const leftSpan = document.createElement('span');
                    leftSpan.innerHTML = hljs.highlight(left, { language: this.language, ignoreIllegals: true }).value;
                    baseLine.appendChild(leftSpan);
                }

                if (pointerColumn > lineText.length) {
                    const extraSpacesCount = pointerColumn - lineText.length;
                    if (extraSpacesCount > 0) baseLine.appendChild(document.createTextNode(' '.repeat(extraSpacesCount)));
                }

                const cursor = document.createElement('span');
                cursor.className = 'next-step-cursor';
                baseLine.appendChild(cursor);

                if (right.length > 0) {
                    const rightSpan = document.createElement('span');
                    rightSpan.innerHTML = hljs.highlight(right, { language: this.language, ignoreIllegals: true }).value;
                    baseLine.appendChild(rightSpan);
                }
            } else {
                const highlighted = hljs.highlight(lineText, { language: this.language, ignoreIllegals: true }).value;
                const contentSpan = document.createElement('span');
                contentSpan.innerHTML = highlighted.length ? highlighted : '\u200B';
                baseLine.appendChild(contentSpan);
            }

            if (startLine !== -1 && endLine !== -1 && idx >= startLine && idx <= endLine) {
                const wrap = document.createElement('span');
                wrap.className = 'newly-typed';
                wrap.appendChild(baseLine);
                fragment.appendChild(wrap);
            } else {
                fragment.appendChild(baseLine);
            }
        }

        // Курсор на новой строке после последней
        if (pointerLineIdx >= lines.length) {
            fragment.appendChild(document.createTextNode('\n'));
            const newLine = document.createElement('span');
            newLine.style.whiteSpace = 'pre';
            if (indentAfterLastNewline > 0) newLine.appendChild(document.createTextNode(' '.repeat(indentAfterLastNewline)));
            const cursor = document.createElement('span');
            cursor.className = 'next-step-cursor';
            newLine.appendChild(cursor);
            fragment.appendChild(newLine);
        }

        this.element.innerHTML = '';
        this.element.appendChild(fragment);
    }

    _renderStep(stepIndex, { placeCursorForNext = false } = {}) {
        this.currentStepIndex = stepIndex;
        const currentText = this.steps[stepIndex];
        const hasNext = stepIndex < this.steps.length - 1;

        if (placeCursorForNext && hasNext) {
            this._renderWithNextCursor(currentText, this.steps[stepIndex + 1]);
        } else {
            this._renderHighlighted(currentText);
        }
        this._updateControls();
        this._ensureVisible();
    }

    nextStep() {
        if (this.isAnimating || this.currentStepIndex >= this.steps.length - 1) return;
        this.isAnimating = true;

        const prevText = this.steps[this.currentStepIndex];
        const nextText = this.steps[this.currentStepIndex + 1];
        const { insertAt, added } = this._diffAddOnly(prevText, nextText);

        // Печатаем только дельту в середину прежнего текста (временно без подсветки)
        this.element.innerHTML = '';

        const leftNode = document.createTextNode(prevText.slice(0, insertAt));
        const typingContainer = document.createElement('span');
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        typingContainer.appendChild(cursor);
        const rightNode = document.createTextNode(prevText.slice(insertAt));

        this.element.appendChild(leftNode);
        this.element.appendChild(typingContainer);
        this.element.appendChild(rightNode);

        let i = 0;
        const type = () => {
            if (i < added.length) {
                const ch = document.createTextNode(added.charAt(i));
                typingContainer.insertBefore(ch, cursor);
                i++;
                
                // Прокручиваем к курсору во время печати каждые несколько символов
                if (i % 10 === 0 || added.charAt(i - 1) === '\n') {
                    this._ensureVisible();
                }
                
                setTimeout(type, 1);
            } else {
                // Удаляем курсор и перерисовываем целиком целевой шаг с подсветкой
                typingContainer.remove();

                const highlightRange = { from: insertAt, to: insertAt + added.length };
                this.highlightedRange = highlightRange;
                
                // Увеличиваем индекс ПЕРЕД проверкой следующего шага
                this.currentStepIndex++;
                
                // Рендерим подсвеченный шаг и сразу добавляем курсор следующего шага поверх
                if (this.currentStepIndex < this.steps.length - 1) {
                    // Теперь используем правильный индекс для следующего шага
                    this._renderHighlightedWithNextCursor(nextText, this.steps[this.currentStepIndex + 1], highlightRange);
                } else {
                    this._renderHighlighted(nextText, highlightRange);
                }

                this.isAnimating = false;
                this._updateControls();
                // Убираем вызов _ensureVisible() в конце анимации
                // this._ensureVisible();
            }
        };
        type();
        this._updateControls();
    }

    previousStep() {
        if (this.isAnimating || this.currentStepIndex <= 0) return;
        this.highlightedRange = null;
        this.currentStepIndex--;
        // Вернуться к предыдущему и показать курсор следующего
        this._renderStep(this.currentStepIndex, { placeCursorForNext: true });
    }

    reset() {
        this.isAnimating = false;
        this.fullCodeRendered = false;
        this.highlightedRange = null;
        this._renderStep(0, { placeCursorForNext: true });
    }

    showAll() {
        this.fullCodeRendered = true;
        this.highlightedRange = null;
        const finalText = this.steps[this.steps.length - 1];
        this._renderHighlighted(finalText);
        this.currentStepIndex = this.steps.length - 1;
        this._updateControls();
    }

    _ensureVisible() {
        // Ищем активный курсор печати
        const typingCursor = this.element.querySelector('.typing-cursor');
        if (typingCursor) {
            // Прокручиваем к активному курсору печати
            const cursorRect = typingCursor.getBoundingClientRect();
            const vh = window.innerHeight;
            const buffer = 100; // Увеличиваем буфер для лучшей видимости
            
            // Проверяем, виден ли курсор на экране
            if (cursorRect.top < buffer || cursorRect.bottom > vh - buffer) {
                typingCursor.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center', 
                    inline: 'nearest' 
                });
            }
        }
        // Убираем fallback к прокрутке всего блока кода
    }
}


