import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eqslifnlscywjppcwupn.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Authentication functions
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function onAuthStateChange(
  callback: (user: any | null, event: string) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null, event);
  });
}

export async function getRedirectResult() {
  // Supabase handles redirect automatically, but we can check the current session
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Database types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          created_at?: string;
        };
      };
      meals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          price: number;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Supabase operations
export async function getUserById(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function createUser(user: { id: string; email: string; name?: string }) {
  const { data, error } = await supabase
    .from('users')
    .insert([{
      id: user.id,
      email: user.email,
      name: user.name
    }]);

  if (error) throw error;
  return data;
}

export async function getAllMeals() {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createMeal(meal: { id: string; user_id: string; name: string; description?: string; price: number }) {
  const { data, error } = await supabase
    .from('meals')
    .insert([{
      id: meal.id,
      user_id: meal.user_id,
      name: meal.name,
      description: meal.description,
      price: meal.price
    }]);

  if (error) throw error;
  return data;
}

export { supabase };
