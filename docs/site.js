const navToggle = document.querySelector(".nav-toggle");
const navigation = document.querySelector("#primary-navigation");
const copyButton = document.querySelector("[data-copy-command]");
const currentYear = document.querySelector("[data-current-year]");

currentYear.textContent = new Date().getFullYear().toString();

navToggle?.addEventListener("click", () => {
  const expanded = navToggle.getAttribute("aria-expanded") === "true";
  navToggle.setAttribute("aria-expanded", String(!expanded));
  navigation?.classList.toggle("is-open", !expanded);
});

navigation?.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  navToggle?.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
});

copyButton?.addEventListener("click", async () => {
  const command = "docker compose up --build --detach --wait";

  try {
    const clipboardWrite = navigator.clipboard?.writeText(command);

    if (!clipboardWrite) {
      throw new Error("Clipboard API unavailable");
    }

    await Promise.race([
      clipboardWrite,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Clipboard timed out")), 500);
      }),
    ]);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 1800);
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = command;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    document.body.appendChild(fallback);
    fallback.select();

    const copied = document.execCommand("copy");
    fallback.remove();
    copyButton.textContent = copied ? "Copied" : "Select command";

    window.setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 1800);
  }
});

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
  );

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}
