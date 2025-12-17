export interface TitledMember {
    firstName: string;
    lastName: string;
    middleName?: string;
    title?: {
        name: string;
        abbreviation?: string;
    };
    [key: string]: any;
}

export const formatMemberName = (member: TitledMember | null | undefined): string => {
    if (!member) return '';

    const titlePart = member.title ? (member.title.abbreviation || member.title.name) : '';
    const names = [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ');

    return titlePart ? `${titlePart} ${names}` : names;
};
