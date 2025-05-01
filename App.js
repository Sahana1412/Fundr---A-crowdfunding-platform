import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe("your_stripe_publishable_key_here"); // Replace with your Stripe publishable key

const categories = [
  { id: "medicine", name: "Medicine" },
  { id: "disaster", name: "Disaster Relief" },
  { id: "education", name: "Education" },
  { id: "animal", name: "Animal Welfare" },
];

// Donation form component using Stripe Elements with styled UI
function DonationForm({ profileId, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState("");
  const [donateToApp, setDonateToApp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (!stripe || !elements) return;

    setLoading(true);

    try {
      // Create payment intent on backend
      const res = await fetch("http://localhost:4000/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          donateToApp,
          profileId,
        }),
      });
      const { clientSecret, error: backendError } = await res.json();
      if (backendError) {
        setError(backendError);
        setLoading(false);
        return;
      }

      // Confirm card payment
      const cardElement = elements.getElement(CardElement);
      const paymentResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (paymentResult.error) {
        setError(paymentResult.error.message);
      } else if (paymentResult.paymentIntent.status === "succeeded") {
        onSuccess();
      }
    } catch (err) {
      setError("Payment failed. Try again.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
      <input
        type="number"
        min="1"
        step="0.01"
        placeholder="Amount in USD"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{
          padding: "0.6rem",
          fontSize: "1rem",
          width: "60%",
          borderRadius: "30px",
          border: "2px solid #764ba2",
          marginRight: "1rem",
          fontWeight: "600",
          color: "#4a4a4a",
          outlineOffset: "3px",
          transition: "border-color 0.3s ease",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#5a357a")}
        onBlur={(e) => (e.target.style.borderColor = "#764ba2")}
      />
      <label
        style={{
          fontSize: "0.9rem",
          userSelect: "none",
          color: "#4a4a4a",
          fontWeight: "600",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
        }}
      >
        <input
          type="checkbox"
          checked={donateToApp}
          onChange={() => setDonateToApp(!donateToApp)}
          style={{ marginRight: "0.3rem", cursor: "pointer" }}
        />
        Donate 10% to platform
      </label>
      <div
        style={{
          margin: "1rem 0",
          padding: "12px 16px",
          border: "2px solid #764ba2",
          borderRadius: "12px",
          backgroundColor: "#fafafa",
          boxShadow: "inset 0 2px 4px rgba(118,75,162,0.1)",
        }}
      >
        <CardElement options={{ style: { base: { fontSize: "16px" } } }} />
      </div>
      <button
        type="submit"
        disabled={!stripe || loading}
        style={{
          padding: "0.6rem 1.5rem",
          fontSize: "1rem",
          cursor: loading ? "not-allowed" : "pointer",
          backgroundColor: "#764ba2",
          color: "white",
          border: "none",
          borderRadius: "30px",
          marginRight: "1rem",
          fontWeight: "700",
          boxShadow: "0 6px 15px rgba(118,75,162,0.5)",
          transition: "background-color 0.3s ease, transform 0.3s ease",
        }}
        onMouseEnter={(e) => (e.target.style.backgroundColor = "#5a357a")}
        onMouseLeave={(e) => (e.target.style.backgroundColor = "#764ba2")}
      >
        {loading ? "Processing..." : "Donate"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: "0.6rem 1.5rem",
          fontSize: "1rem",
          cursor: "pointer",
          backgroundColor: "#aaa",
          color: "white",
          border: "none",
          borderRadius: "30px",
          fontWeight: "700",
          boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
          transition: "background-color 0.3s ease",
        }}
        onMouseEnter={(e) => (e.target.style.backgroundColor = "#888")}
        onMouseLeave={(e) => (e.target.style.backgroundColor = "#aaa")}
      >
        Cancel
      </button>
      {error && (
        <div
          style={{
            color: "red",
            marginTop: "0.5rem",
            fontWeight: "600",
            userSelect: "none",
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}

function App() {
  const [page, setPage] = useState("home");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [message, setMessage] = useState("");
  const [newProfile, setNewProfile] = useState({
    category: "medicine",
    name: "",
    picture: "",
    biodata: "",
    purpose: "",
  });
  const [donationProfileId, setDonationProfileId] = useState(null);

  // Fetch profiles from backend when category or page changes
  useEffect(() => {
    async function fetchProfiles() {
      const url = selectedCategory
        ? `http://localhost:4000/profiles?category=${selectedCategory}`
        : "http://localhost:4000/profiles";
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch profiles");
        const data = await res.json();
        setProfiles(data);
      } catch {
        setMessage("Error loading profiles. Please try again later.");
      }
    }
    if (page === "profiles") fetchProfiles();
  }, [page, selectedCategory]);

  function goToCategory(catId) {
    setSelectedCategory(catId);
    setPage("profiles");
    setMessage("");
    setDonationProfileId(null);
  }

  async function handleCreateProfile(e) {
    e.preventDefault();
    const { category, name, picture, biodata, purpose } = newProfile;
    if (!name || !picture || !biodata || !purpose) {
      setMessage("Please fill in all fields.");
      return;
    }
    try {
      const res = await fetch("http://localhost:4000/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile),
      });
      if (!res.ok) throw new Error("Failed to create profile");
      await res.json();
      setMessage("Profile created successfully!");
      setNewProfile({
        category: "medicine",
        name: "",
        picture: "",
        biodata: "",
        purpose: "",
      });
      setPage("categories");
    } catch {
      setMessage("Error creating profile.");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          font-family: 'Poppins', sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          color: #2c3e50;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        header {
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1.5rem 2rem;
          text-align: center;
          font-weight: 800;
          font-size: 2.2rem;
          letter-spacing: 1.5px;
          box-shadow: 0 4px 15px rgba(118,75,162,0.6);
          user-select: none;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        nav {
          margin: 1rem 2rem;
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        nav button {
          background: #764ba2;
          border: none;
          color: white;
          padding: 0.7rem 1.5rem;
          border-radius: 30px;
          cursor: pointer;
          font-weight: 700;
          font-size: 1rem;
          transition: background-color 0.4s ease, transform 0.3s ease;
          box-shadow: 0 4px 8px rgba(118,75,162,0.4);
          user-select: none;
        }
        nav button:hover {
          background: #5a357a;
          transform: scale(1.05);
        }
        main {
          max-width: 900px;
          margin: 1rem auto 3rem;
          background: white;
          padding: 2.5rem 3rem;
          border-radius: 20px;
          box-shadow: 0 12px 30px rgba(102,126,234,0.3);
          flex-grow: 1;
        }
        h1, h2, h3 {
          color: #4a4a4a;
          font-weight: 700;
          letter-spacing: 0.8px;
        }
        h1 {
          font-size: 2.4rem;
          margin-bottom: 1rem;
        }
        h2 {
          font-size: 1.8rem;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        p, ul {
          font-size: 1.1rem;
          line-height: 1.6;
          color: #555;
        }
        ul {
          padding-left: 1.3rem;
          margin-bottom: 1rem;
        }
        ul li {
          margin-bottom: 0.5rem;
        }
        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(180px,1fr));
          gap: 1.8rem;
          margin-top: 2.5rem;
        }
        .category-card {
          background: #8e7cc3;
          border-radius: 18px;
          padding: 2rem 1.5rem;
          text-align: center;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(118,75,162,0.4);
          transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease;
          font-weight: 700;
          color: white;
          user-select: none;
          font-size: 1.2rem;
          letter-spacing: 0.8px;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 120px;
        }
        .category-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 15px 30px rgba(118,75,162,0.6);
          background: #6b54a6;
        }
        .profile-list {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(280px,1fr));
          gap: 2rem;
          margin-top: 2.5rem;
        }
        .profile-card {
          background: #f7f8fc;
          border-radius: 20px;
          padding: 1.5rem 1.8rem;
          box-shadow: 0 8px 20px rgba(102,126,234,0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: box-shadow 0.3s ease, transform 0.3s ease;
          user-select: none;
        }
        .profile-card:hover {
          box-shadow: 0 15px 35px rgba(102,126,234,0.3);
          transform: translateY(-6px);
        }
        .profile-pic {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 0 15px rgba(118,75,162,0.5);
          margin-bottom: 1.2rem;
          border: 4px solid #764ba2;
        }
        .profile-name {
          font-size: 1.4rem;
          font-weight: 800;
          margin-bottom: 0.4rem;
          color: #4a4a4a;
          text-align: center;
        }
        .profile-biodata,
        .profile-purpose {
          font-size: 1rem;
          margin-bottom: 0.8rem;
          color: #666;
          text-align: center;
          line-height: 1.4;
        }
        form.create-profile {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
          max-width: 520px;
          margin: 0 auto;
        }
        form.create-profile label {
          font-weight: 700;
          color: #4a4a4a;
          font-size: 1.1rem;
        }
        form.create-profile input,
        form.create-profile textarea,
        form.create-profile select {
          padding: 0.6rem;
          border: 2px solid #764ba2;
          border-radius: 12px;
          font-size: 1.1rem;
          outline-offset: 3px;
          transition: border-color 0.3s ease;
          width: 100%;
          font-weight: 600;
          color: #4a4a4a;
          font-family: 'Poppins', sans-serif;
        }
        form.create-profile input:focus,
        form.create-profile textarea:focus,
        form.create-profile select:focus {
          border-color: #5a357a;
        }
        .message {
          margin-top: 1.5rem;
          padding: 1rem 1.2rem;
          background: #d4edda;
          border: 1.5px solid #a3c293;
          color: #3c763d;
          border-radius: 12px;
          max-width: 650px;
          margin-left: auto;
          margin-right: auto;
          text-align: center;
          font-weight: 700;
          user-select: none;
          box-shadow: 0 4px 12px rgba(102,126,234,0.2);
        }
        footer {
          text-align: center;
          padding: 1.2rem 1rem;
          color: #6b54a6;
          font-size: 1rem;
          font-weight: 600;
          user-select: none;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          box-shadow: 0 -4px 15px rgba(118,75,162,0.6);
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          margin-top: auto;
        }
        @media (max-width: 600px) {
          nav {
            flex-direction: column;
          }
          main {
            padding: 1.5rem 1.5rem 3rem;
            margin: 1rem 1rem 3rem;
          }
          .donation-form input[type="number"],
          .donation-form button {
            width: 100%;
          }
        }
      `}</style>

      <header>Fundr - Donate to Those in Need</header>

      <nav>
        <button onClick={() => { setPage("home"); setMessage(""); setDonationProfileId(null); }}>
          Home
        </button>
        <button onClick={() => { setPage("categories"); setMessage(""); setDonationProfileId(null); }}>
          Categories
        </button>
        <button onClick={() => { setPage("create-profile"); setMessage(""); setDonationProfileId(null); }}>
          Create Profile
        </button>
      </nav>

      <main>
        {page === "home" && (
          <>
            <h1>Welcome to Fundr</h1>
            <p>
              Fundr is a platform dedicated to connecting generous donors with people and causes in need. Our mission is to facilitate transparent and impactful donations to individuals and communities requiring support in Medicine, Disaster Relief, Education, and Animal Welfare.
            </p>
            <h2>Our Goals</h2>
            <ul>
              <li>Empower people to help others directly through verified profiles.</li>
              <li>Make donating easy, transparent, and meaningful.</li>
              <li>Support a wide range of causes to maximize impact.</li>
              <li>Build a compassionate community driven by generosity and trust.</li>
            </ul>
            <h2>Our Values</h2>
            <ul>
              <li><strong>Transparency:</strong> Every donation is tracked and acknowledged.</li>
              <li><strong>Empathy:</strong> We believe in the power of kindness and understanding.</li>
              <li><strong>Security:</strong> Profiles are verified to ensure authenticity.</li>
              <li><strong>Inclusivity:</strong> Supporting diverse causes and communities worldwide.</li>
            </ul>
            <p style={{fontStyle: "italic", marginTop: "2rem"}}>
              Join us in making a difference, one donation at a time.
            </p>
          </>
        )}

        {page === "categories" && (
          <>
            <h1>Choose a Category</h1>
            <div className="category-grid">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="category-card"
                  onClick={() => goToCategory(cat.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") goToCategory(cat.id);
                  }}
                  aria-label={`Select category ${cat.name}`}
                >
                  {cat.name}
                </div>
              ))}
            </div>
          </>
        )}

        {page === "profiles" && selectedCategory && (
          <>
            <h1>
              {categories.find((c) => c.id === selectedCategory)?.name} Profiles
            </h1>
            {profiles.length === 0 && (
              <p>No profiles found under this category.</p>
            )}
            <div className="profile-list">
              {profiles.map((profile) => (
                <div key={profile._id} className="profile-card">
                  <img
                    src={profile.picture}
                    alt={`${profile.name}'s portrait`}
                    className="profile-pic"
                    loading="lazy"
                  />
                  <div className="profile-name">{profile.name}</div>
                  <div className="profile-biodata">{profile.biodata}</div>
                  <div className="profile-purpose">
                    <strong>Purpose:</strong> {profile.purpose}
                  </div>

                  {donationProfileId === profile._id ? (
                    <DonationForm
                      profileId={profile._id}
                      onSuccess={() => {
                        setMessage("Thank you for your donation!");
                        setDonationProfileId(null);
                      }}
                      onCancel={() => setDonationProfileId(null)}
                    />
                  ) : (
                    <button
                      style={{ marginTop: "auto" }}
                      onClick={() => setDonationProfileId(profile._id)}
                      aria-label={`Start donation to ${profile.name}`}
                    >
                      Donate to this profile
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {page === "create-profile" && (
          <>
            <h1>Create a New Profile</h1>
            <form className="create-profile" onSubmit={handleCreateProfile}>
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={newProfile.category}
                onChange={(e) =>
                  setNewProfile((prev) => ({ ...prev, category: e.target.value }))
                }
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                placeholder="Full name or group name"
                value={newProfile.name}
                onChange={(e) =>
                  setNewProfile((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />

              <label htmlFor="picture">Picture URL</label>
              <input
                id="picture"
                type="url"
                placeholder="Link to profile picture"
                value={newProfile.picture}
                onChange={(e) =>
                  setNewProfile((prev) => ({ ...prev, picture: e.target.value }))
                }
                required
              />

              <label htmlFor="biodata">Biodata</label>
              <textarea
                id="biodata"
                rows="3"
                placeholder="Brief biodata"
                value={newProfile.biodata}
                onChange={(e) =>
                  setNewProfile((prev) => ({ ...prev, biodata: e.target.value }))
                }
                required
              ></textarea>

              <label htmlFor="purpose">Purpose for Fund Need</label>
              <textarea
                id="purpose"
                rows="3"
                placeholder="Explain why funds are needed"
                value={newProfile.purpose}
                onChange={(e) =>
                  setNewProfile((prev) => ({ ...prev, purpose: e.target.value }))
                }
                required
              ></textarea>

              <button type="submit" aria-label="Create profile">
                Create Profile
              </button>
            </form>
          </>
        )}

        {message && <div className="message" role="alert">{message}</div>}
      </main>

      <footer>
        &copy; {new Date().getFullYear()} Fundr. All rights reserved.
      </footer>
    </>
  );
}

export default App;
