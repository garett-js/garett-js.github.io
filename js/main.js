 // Initialize Highlight.js
 hljs.highlightAll();

 function toggleTheme(themeName) {
     var themeLink = document.getElementById('theme-style');
     themeLink.href = "highlight/styles/" + themeName + ".css";
     try {
         document.querySelectorAll('pre code').forEach((block) => {
             block.classList.remove(...Array.from(block.classList).filter(cls => cls.startsWith('hljs')));
             block.removeAttribute('data-highlighted');
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