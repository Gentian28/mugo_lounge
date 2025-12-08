document.addEventListener("DOMContentLoaded", () => {
  const tabs = Array.from(document.querySelectorAll(".menu-tab"));
  const cards = Array.from(document.querySelectorAll(".menu-card"));

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-target");
      if (!targetId) return;

      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      cards.forEach((card) => {
        if (card.id === targetId) {
          card.classList.add("active");
        } else {
          card.classList.remove("active");
        }
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
});
