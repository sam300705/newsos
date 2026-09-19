"use server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function credentials(formData: FormData){const email=String(formData.get('email')??'').trim(); const password=String(formData.get('password')??''); if(!email.includes('@')||password.length<8)throw new Error('Enter a valid email and a password of at least 8 characters'); return{email,password};}
export async function signIn(formData:FormData){const db=await createServerSupabaseClient(); const {error}=await db.auth.signInWithPassword(credentials(formData)); if(error)redirect(`/login?error=${encodeURIComponent(error.message)}`); redirect('/admin');}
export async function signUp(formData:FormData){const db=await createServerSupabaseClient(); const c=credentials(formData); const {error}=await db.auth.signUp(c); if(error)redirect(`/login?error=${encodeURIComponent(error.message)}`); redirect('/login?message=Check%20your%20email%20to%20confirm%20your%20account.');}
