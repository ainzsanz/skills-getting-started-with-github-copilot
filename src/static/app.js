document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const template = document.getElementById("activity-card-template");

  function showMessage(text, type = "info") {
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function createParticipantItem(email, activityName) {
    const li = document.createElement("li");
    li.className = "participant-item";

    const span = document.createElement("span");
    span.className = "participant-badge";
    span.textContent = email;
    li.appendChild(span);

    // remove button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "participant-remove";
    btn.title = "Unregister participant";
    btn.setAttribute("aria-label", `Unregister ${email}`);
    btn.innerHTML = "✖";
    btn.addEventListener("click", async () => {
      if (!activityName) return;
      try {
        const res = await fetch(
          `/activities/${encodeURIComponent(activityName)}/participants?email=${encodeURIComponent(email)}`,
          { method: "DELETE" }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          // remove from DOM
          if (li.parentNode) li.parentNode.removeChild(li);
          showMessage(data.message || `Unregistered ${email} from ${activityName}`, "info");

          // update availability display
          const card = findActivityCard(activityName);
          if (card) {
            const availEl = card.querySelector(".activity-availability");
            if (availEl) {
              const match = availEl.textContent.match(/(\d+)\s*spots/);
              if (match) {
                let n = Math.max(0, parseInt(match[1], 10) + 1);
                availEl.innerHTML = `<strong>Availability:</strong> ${n} spots left`;
              }
            }
            const participantsList = card.querySelector(".participants-list");
            const noParticipants = card.querySelector(".no-participants");
            if (participantsList && participantsList.children.length === 0 && noParticipants) {
              noParticipants.classList.remove("hidden");
            }
          }
        } else {
          showMessage(data.detail || data.message || "Failed to unregister", "error");
        }
      } catch (err) {
        console.error(err);
        showMessage("Network error while unregistering.", "error");
      }
    });

    li.appendChild(btn);
    return li;
  }

  function addOptionIfMissing(name) {
    if (!Array.from(activitySelect.options).some(o => o.value === name)) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      activitySelect.appendChild(option);
    }
  }

  function findActivityCard(activityName) {
    const cards = Array.from(document.querySelectorAll('.activity-card'));
    return cards.find(c => c.dataset && c.dataset.activity === activityName) || null;
  }

  function renderActivities(activities) {
    activitiesList.innerHTML = "";
    // preserve placeholder option
    const placeholder = activitySelect.querySelector('option[value=""]');
    clear(activitySelect);
    if (placeholder) activitySelect.appendChild(placeholder);

    Object.entries(activities).forEach(([name, details]) => {
      const spotsLeft = Math.max(0, (details.max_participants || 0) - (details.participants?.length || 0));

      if (template && template.content) {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector(".activity-card");
        if (card) card.dataset.activity = name;

        const title = clone.querySelector(".activity-title");
        const desc = clone.querySelector(".activity-desc");
        const sched = clone.querySelector(".activity-schedule");
        const participantsList = clone.querySelector(".participants-list");
        const noParticipants = clone.querySelector(".no-participants");

        if (title) title.textContent = name;
        if (desc) desc.textContent = details.description || "";
        if (sched) sched.innerHTML = `<strong>Schedule:</strong> ${details.schedule || ""}`;

        // optional availability element
        const avail = document.createElement("p");
        avail.className = "activity-availability";
        avail.innerHTML = `<strong>Availability:</strong> ${spotsLeft} spots left`;
        if (sched && sched.parentNode) sched.parentNode.insertBefore(avail, sched.nextSibling);

        // participants
        if (participantsList) {
          clear(participantsList);
          if (Array.isArray(details.participants) && details.participants.length) {
            details.participants.forEach(p => participantsList.appendChild(createParticipantItem(p, name)));
            if (noParticipants) noParticipants.classList.add("hidden");
          } else {
            if (noParticipants) noParticipants.classList.remove("hidden");
          }
        }

        activitiesList.appendChild(clone);
      } else {
        // fallback: build card manually
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";
        activityCard.dataset.activity = name;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p class="activity-desc">${details.description || ""}</p>
          <p class="activity-schedule"><strong>Schedule:</strong> ${details.schedule || ""}</p>
        `;
        const avail = document.createElement("p");
        avail.className = "activity-availability";
        avail.innerHTML = `<strong>Availability:</strong> ${spotsLeft} spots left`;
        activityCard.appendChild(avail);

        const participantsContainer = document.createElement("div");
        participantsContainer.className = "participants";
        participantsContainer.innerHTML = `<h5>Participants</h5>`;
        const ul = document.createElement("ul");
        ul.className = "participants-list";
        if (Array.isArray(details.participants) && details.participants.length) {
          details.participants.forEach(p => ul.appendChild(createParticipantItem(p, name)));
          const noP = document.createElement("p");
          noP.className = "no-participants hidden";
          noP.textContent = "No participants yet.";
          participantsContainer.appendChild(ul);
          participantsContainer.appendChild(noP);
        } else {
          const noP = document.createElement("p");
          noP.className = "no-participants";
          noP.textContent = "No participants yet.";
          participantsContainer.appendChild(ul);
          participantsContainer.appendChild(noP);
        }
        activityCard.appendChild(participantsContainer);
        activitiesList.appendChild(activityCard);
      }

      addOptionIfMissing(name);
    });
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) throw new Error("Failed to load activities");
      const activities = await response.json();
      renderActivities(activities);
    } catch (err) {
      activitiesList.innerHTML = "<p class=\"error\">Failed to load activities. Please try again later.</p>";
      console.error(err);
    }
  }

  function addParticipantToCard(activityName, email) {
    const card = findActivityCard(activityName);
    if (!card) return;
    const participantsList = card.querySelector(".participants-list");
    const noParticipants = card.querySelector(".no-participants");
    if (participantsList) participantsList.appendChild(createParticipantItem(email, activityName));
    if (noParticipants) noParticipants.classList.add("hidden");

    const availEl = card.querySelector(".activity-availability");
    if (availEl) {
      const match = availEl.textContent.match(/(\d+)\s*spots/);
      if (match) {
        let n = Math.max(0, parseInt(match[1], 10) - 1);
        availEl.innerHTML = `<strong>Availability:</strong> ${n} spots left`;
      }
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const activity = document.getElementById("activity").value;
    if (!activity || !email) { showMessage("Please select an activity and enter your email.", "error"); return; }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        { method: "POST" }
      );
      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        showMessage(result.message || "Signed up successfully!", "success");
        addParticipantToCard(activity, email);
        signupForm.reset();
      } else {
        showMessage(result.detail || result.message || "Signup failed", "error");
      }
    } catch (err) {
      console.error(err);
      showMessage("Network error during signup.", "error");
    }
  });

  // initial load
  fetchActivities();
});
