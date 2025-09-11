 // Initialize Highlight.js
// hljs.highlightAll();

 function toggleTheme(themeName) {
     var themeLink = document.getElementById('theme-style');
     themeLink.href = "../../lib/highlight/styles/" + themeName + ".css";
     try {
         // Re-highlight all code blocks EXCEPT the ones managed by our interactive script
         document.querySelectorAll('pre code:not(.interactive-code-managed)').forEach((block) => {
             hljs.highlightElement(block);
         });
     } catch (e) {
         console.error("Highlight.js error:", e);
     }
 }

 // Scroll to top button functionality
 const scrollToTopButton = document.getElementById('scrollToTop');

 window.onscroll = function() {
     if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
         scrollToTopButton.style.display = 'block';
     } else {
         scrollToTopButton.style.display = 'none';
     }
 };

 scrollToTopButton.onclick = function() {
     window.scrollTo({ top: 0, behavior: 'smooth' });
 };

 document.addEventListener('DOMContentLoaded', function() {
     // Initialize Highlight.js
     try {
         document.querySelectorAll('pre code:not(.interactive-code-managed)').forEach((block) => {
             hljs.highlightElement(block);
         });
     } catch (e) {
         console.error("Highlight.js error:", e);
     }
     
     // Add comment toggle switches to all <pre> blocks
    document.querySelectorAll('pre > code').forEach(codeBlock => {
        const preBlock = codeBlock.parentElement;
        
        preBlock.style.position = 'relative';

        const switchContainer = document.createElement('div');
        switchContainer.className = 'comment-switch-container';

        // const switchText = document.createElement('span');
        // switchText.textContent = 'Комментарии';
        // switchContainer.appendChild(switchText);

        const switchLabel = document.createElement('label');
        switchLabel.className = 'comment-switch';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false; // Comments are off by default

        const slider = document.createElement('span');
        slider.className = 'slider round';

        switchLabel.appendChild(checkbox);
        switchLabel.appendChild(slider);
        switchContainer.appendChild(switchLabel);

        preBlock.appendChild(switchContainer);

        // --- Tooltip for comment switch ---
        const updateTooltip = () => {
            switchContainer.title = checkbox.checked ? 'Скрыть комментарии' : 'Показать комментарии';
        };
        updateTooltip(); // Set initial tooltip

        // Apply initial state - comments off by default
        preBlock.classList.toggle('comments-off', !checkbox.checked);

        checkbox.addEventListener('change', () => {
            preBlock.classList.toggle('comments-off', !checkbox.checked);
            updateTooltip(); // Update tooltip on change
        });

        // --- Copy code button ---
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-code-button';
        copyButton.title = 'Копировать код';
        copyButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
            </svg>`;

        preBlock.appendChild(copyButton);

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                copyButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-lg" viewBox="0 0 16 16">
                        <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022z"/>
                    </svg>`;
                copyButton.title = 'Скопировано!';
                copyButton.classList.add('copied');

                setTimeout(() => {
                    copyButton.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16">
                            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                        </svg>`;
                    copyButton.title = 'Копировать код';
                    copyButton.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                copyButton.title = 'Ошибка копирования';
            });
        });
    });

     const menu = document.querySelector('#side-menu ul');
     const sections = document.querySelectorAll('.lesson-section');
     const headers = document.querySelectorAll('#main-content h2');

     headers.forEach((header, index) => {
         const sectionId = `section-${index + 1}`;
         const section = header.closest('.lesson-section');
         if (section) {
             section.id = sectionId;

             const listItem = document.createElement('li');
             const link = document.createElement('a');
             link.href = `#${sectionId}`;
             link.textContent = `${index + 1}. ${header.textContent}`;
             link.dataset.sectionId = sectionId;

             listItem.appendChild(link);
             menu.appendChild(listItem);

             if (index < headers.length - 1) {
                 const nextBtn = document.createElement('button');
                 nextBtn.textContent = 'Далее';
                 nextBtn.classList.add('next-section-btn');
                 nextBtn.dataset.nextSectionId = `section-${index + 2}`;
                 section.appendChild(nextBtn);
             }
         }
     });

     const nextButtons = document.querySelectorAll('.next-section-btn');

     function showSection(sectionId, event) {
         if(event) event.preventDefault();
         
         let targetSection = document.getElementById(sectionId);
         if (!targetSection) return;

         sections.forEach(section => {
             section.classList.remove('active');
         });

         targetSection.classList.add('active');

         const menuLinks = document.querySelectorAll('#side-menu ul a');
         menuLinks.forEach(link => {
             link.classList.toggle('active', link.dataset.sectionId === sectionId);
         });

         window.scrollTo({ top: 0, behavior: 'auto' });
     }

     menu.addEventListener('click', function(e) {
         if (e.target.tagName === 'A') {
             const sectionId = e.target.dataset.sectionId;
             showSection(sectionId, e);
         }
     });

     nextButtons.forEach(button => {
         button.addEventListener('click', function(e) {
             const nextSectionId = e.target.dataset.nextSectionId;
             showSection(nextSectionId, e);
         });
     });

     if (sections.length > 0) {
         const firstNavigableSection = document.querySelector('#side-menu ul a');
         if (firstNavigableSection) {
             showSection(firstNavigableSection.dataset.sectionId);
         } else if (sections[0]) {
             sections[0].classList.add('active');
         }
     }
 });