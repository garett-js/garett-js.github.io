document.addEventListener('DOMContentLoaded', () => {
    const slideshowContainers = document.querySelectorAll('.slideshow-container');

    slideshowContainers.forEach(container => {
        const slideshowWrapper = container.querySelector('.slideshow-wrapper');
        const slideshow = container.querySelector('.slideshow');
        if (!slideshow) return;

        // Установка ширины из атрибута data-width
        const containerWidth = container.dataset.width;
        if (containerWidth) {
            container.style.maxWidth = containerWidth;
        }

        const slides = Array.from(slideshow.querySelectorAll('.slide'));
        const prevBtn = container.querySelector('.prev-btn');
        const nextBtn = container.querySelector('.next-btn');
        const dotsContainer = container.querySelector('.dots-container');

        let currentSlide = 0;
        let isAnimating = false;

        // Функция для установки высоты wrapper'а
        function setWrapperHeight() {
            if (slides.length > 0 && slideshowWrapper) {
                const activeSlide = slides[currentSlide];
                const activeImage = activeSlide.querySelector('img');
                if (activeImage) {
                    // Используем requestAnimationFrame для более плавного обновления
                    requestAnimationFrame(() => {
                         // Ждем загрузки изображения, чтобы получить его реальную высоту
                        if (activeImage.complete) {
                            slideshowWrapper.style.height = `${activeImage.clientHeight}px`;
                        } else {
                            activeImage.onload = () => {
                                slideshowWrapper.style.height = `${activeImage.clientHeight}px`;
                            };
                        }
                    });
                }
            }
        }

        if (dotsContainer) {
            slides.forEach((_, i) => {
                const dot = document.createElement('span');
                dot.classList.add('dot');
                if (i === 0) dot.classList.add('active');
                dot.dataset.slide = i;
                dotsContainer.appendChild(dot);
            });
        }

        const dots = container.querySelectorAll('.dot');

        function updateButtons() {
            if (prevBtn) {
                prevBtn.disabled = currentSlide === 0;
            }
            if (nextBtn) {
                nextBtn.disabled = currentSlide === slides.length - 1;
            }
        }

        function goToSlide(newSlideIndex) {
            if (isAnimating || newSlideIndex < 0 || newSlideIndex >= slides.length || newSlideIndex === currentSlide) {
                return;
            }

            isAnimating = true;
            const oldSlideIndex = currentSlide;
            currentSlide = newSlideIndex;

            const newSlide = slides[currentSlide];
            const oldSlide = slides[oldSlideIndex];
            
            newSlide.style.zIndex = 1;
            newSlide.classList.add('active');

            // Устанавливаем высоту после активации нового слайда
            setWrapperHeight();

            // Используем transitionend для отслеживания завершения анимации
            const onTransitionEnd = () => {
                oldSlide.classList.remove('active');
                oldSlide.style.zIndex = '';
                newSlide.style.zIndex = '';
                isAnimating = false;
                newSlide.removeEventListener('transitionend', onTransitionEnd);
            };
            newSlide.addEventListener('transitionend', onTransitionEnd);


            if (dots.length > 0) {
                dots.forEach(dot => dot.classList.remove('active'));
                dots[currentSlide].classList.add('active');
            }
            
            updateButtons();
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                goToSlide(currentSlide + 1);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                goToSlide(currentSlide - 1);
            });
        }
        
        if (dotsContainer) {
            dotsContainer.addEventListener('click', e => {
                if (e.target.classList.contains('dot')) {
                    const slideIndex = parseInt(e.target.dataset.slide, 10);
                    goToSlide(slideIndex);
                }
            });
        }

        if (slides.length > 0) {
            slides[0].classList.add('active');
            // Убираем вызов setWrapperHeight() отсюда, так как он может быть вызван, когда элемент скрыт
        }
        updateButtons();

        // Используем IntersectionObserver для установки высоты, когда слайд-шоу становится видимым
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setWrapperHeight();
                    // Мы можем перестать наблюдать после первой видимости,
                    // но оставим на случай, если элемент снова скроется/появится
                }
            });
        }, { threshold: 0.01 }); // Запускаем, как только хотя бы 1% элемента виден

        observer.observe(container);

        // Пересчитываем высоту при изменении размера окна
        window.addEventListener('resize', setWrapperHeight);
    });
});
