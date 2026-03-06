import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'user_stars';

interface UserStars {
  [skillId: string]: boolean;
}

interface UseSkillStarsReturn {
  starCount: number;
  hasStarred: boolean;
  handleStarClick: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Safely parse localStorage data with error handling
 */
function getUserStarsFromStorage(): UserStars {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    console.warn('Failed to parse user_stars from localStorage:', error);
    return {};
  }
}

/**
 * Safely save to localStorage with error handling
 */
function saveUserStarsToStorage(stars: UserStars): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stars));
  } catch (error) {
    console.warn('Failed to save user_stars to localStorage:', error);
  }
}

/**
 * Hook to manage skill starring functionality
 * Handles localStorage persistence, optimistic UI updates, and Worker API sync
 */
export function useSkillStars(skillId: string | undefined): UseSkillStarsReturn {
  const [starCount, setStarCount] = useState<number>(0);
  const [hasStarred, setHasStarred] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initialize star count from API and check if user has starred
  useEffect(() => {
    if (!skillId) return;

    const initializeStars = async () => {
      // Check localStorage for user's starred status
      const userStars = getUserStarsFromStorage();
      setHasStarred(!!userStars[skillId]);

      // Fetch star count from API
      try {
        const response = await fetch(`/api/stars/${encodeURIComponent(skillId)}`);

        if (response.ok) {
          const data: { skillId: string; starCount: number } = await response.json();
          setStarCount(data.starCount || 0);
        }
      } catch (err) {
        console.warn('Failed to fetch star count:', err);
      }
    };

    initializeStars();
  }, [skillId]);

  /**
   * Handle star button click
   * Prevents double-starring, updates optimistically, syncs to Worker API
   */
  const handleStarClick = useCallback(async () => {
    if (!skillId || isLoading) return;

    // Check if user has already starred (prevent spam)
    const userStars = getUserStarsFromStorage();
    if (userStars[skillId]) return;

    setIsLoading(true);

    try {
      // Optimistically update UI
      setStarCount(prev => prev + 1);
      setHasStarred(true);

      // Persist to localStorage
      const updatedStars = { ...userStars, [skillId]: true };
      saveUserStarsToStorage(updatedStars);

      // Sync to Worker API
      const response = await fetch(`/api/stars/${encodeURIComponent(skillId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to increment star count: ${response.status}`);
      }

      const data: { skillId: string; starCount: number } = await response.json();

      // Update with actual count from server
      setStarCount(data.starCount);
    } catch (error) {
      // Rollback optimistic update on error
      console.error('Failed to star skill:', error);
      setStarCount(prev => Math.max(0, prev - 1));
      setHasStarred(false);

      // Remove from localStorage on error
      const userStars = getUserStarsFromStorage();
      if (userStars[skillId]) {
        const { [skillId]: _, ...rest } = userStars;
        saveUserStarsToStorage(rest);
      }
    } finally {
      setIsLoading(false);
    }
  }, [skillId, isLoading]);

  return {
    starCount,
    hasStarred,
    handleStarClick,
    isLoading
  };
}

export default useSkillStars;
