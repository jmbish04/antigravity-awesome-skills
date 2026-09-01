import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Skill, StarMap } from '../types';

interface SkillContextType {
    skills: Skill[];
    stars: StarMap;
    loading: boolean;
    refreshSkills: () => Promise<void>;
}

const SkillContext = createContext<SkillContextType | undefined>(undefined);

export function SkillProvider({ children }: { children: React.ReactNode }) {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [stars] = useState<StarMap>({}); // Stars loaded per-skill via useSkillStars hook
    const [loading, setLoading] = useState(true);

    const fetchSkillsAndStars = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Fetch skills index
            const res = await fetch('/skills.json');
            const data: Skill[] = await res.json();

            // Incremental loading: set first 50 skills immediately if not a silent refresh
            if (!silent && data.length > 50) {
                setSkills(data.slice(0, 50));
                setLoading(false); // Clear loading state as soon as we have initial content
            } else {
                setSkills(data);
            }

            // Note: Star data is now loaded per-skill via the useSkillStars hook
            // We keep this for batch star loading if needed in the future

            // Finally set the full set of skills if we did incremental load
            if (!silent && data.length > 50) {
                setSkills(data);
            } else if (silent) {
                setSkills(data);
            }

        } catch (err) {
            console.error('SkillContext: Failed to load skills', err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSkillsAndStars();
    }, [fetchSkillsAndStars]);

    const refreshSkills = useCallback(async () => {
        await fetchSkillsAndStars(true);
    }, [fetchSkillsAndStars]);

    const value = useMemo(() => ({
        skills,
        stars,
        loading,
        refreshSkills
    }), [skills, stars, loading, refreshSkills]);

    return (
        <SkillContext.Provider value={value}>
            {children}
        </SkillContext.Provider>
    );
}

export function useSkills() {
    const context = useContext(SkillContext);
    if (context === undefined) {
        throw new Error('useSkills must be used within a SkillProvider');
    }
    return context;
}
