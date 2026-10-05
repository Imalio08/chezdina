import React from "react";
import { Link } from "react-router-dom";

export default function Account() {
  return (
    <div className="max-w-md mx-auto px-4 py-10 text-center">
      <h1 className="font-serif text-3xl mb-3">Mon compte</h1>
      <p className="text-sm text-[#666] mb-6">Connectez-vous avec votre numéro pour retrouver vos commandes, points de fidélité et porte-monnaie.</p>
      <input className="dina-input mb-3" placeholder="+225 XX XX XX XX XX" data-testid="account-phone"/>
      <button className="dina-btn-primary w-full" data-testid="account-login">Recevoir un code</button>
      <div className="text-xs text-[#666] mt-6">Pas encore cliente ? Faites votre première commande puis créez votre compte à la caisse.</div>
      <Link to="/boutique" className="dina-btn-secondary w-full mt-4">Retour boutique</Link>
    </div>
  );
}
