'use strict';
const menuButton = document.querySelector('.menu-toggle');
const lessonNav = document.querySelector('#lessonNav');
function closeMenu() {
  lessonNav.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '수업 메뉴 열기');
}
menuButton.addEventListener('click', () => {
  const open = lessonNav.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? '수업 메뉴 닫기' : '수업 메뉴 열기');
});
lessonNav.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && lessonNav.classList.contains('is-open')) {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('header')) closeMenu();
});
window.matchMedia('(max-width: 700px)').addEventListener('change', closeMenu);
