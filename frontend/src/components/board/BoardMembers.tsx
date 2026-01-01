import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatMemberName } from '../../utils/formatName';

interface Member {
    id: number;
    name: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    title?: {
        name: string;
        abbreviation?: string;
    };
    role: string;
    image?: string;
    email?: string;
    phone?: string;
}

const BoardMembers: React.FC = () => {
    const { t } = useLanguage();
    const [members, setMembers] = React.useState<Member[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchMembers = async () => {
            try {
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                const response = await fetch(`${apiUrl}/api/departments/board-members`);

                if (!response.ok) {
                    throw new Error('Failed to fetch board members');
                }

                const data = await response.json();
                if (data.success && Array.isArray(data.data)) {
                    const mappedMembers = data.data.map((m: any) => {
                        const firstNameLower = m.first_name.toLowerCase();
                        const knownImages = ['afework', 'dawit', 'fetsum', 'alemseged', 'hamelmal', 'desta', 'tafese', 'seifu', 'solomon', 'merafe', 'teshager'];

                        let imageUrl = `https://ui-avatars.com/api/?name=${m.first_name}+${m.last_name}&background=fef3c7&color=92400e`;

                        if (knownImages.includes(firstNameLower)) {
                            imageUrl = `${process.env.PUBLIC_URL || ''}/images/leadership/${firstNameLower}.png`;
                        }

                        // Construct member object for formatName utility
                        const memberData = {
                            firstName: m.first_name,
                            lastName: m.last_name,
                            middleName: m.middle_name,
                            title: m.title
                        };

                        return {
                            id: Number(m.member_id),
                            // ID 331 is Father Tadesse, handle specially
                            name: Number(m.member_id) === 331
                                ? "መልኣከ ፀሃይ Mel’Ake Tsehay keshi Tadesse"
                                : formatMemberName(memberData),
                            firstName: m.first_name,
                            lastName: m.last_name,
                            title: m.title,
                            role: m.role_in_department,
                            email: m.email,
                            phone: m.phone_number,
                            image: imageUrl
                        };
                    });

                    // Custom Sort Order
                    const rolePriority: { [key: string]: number } = {
                        'chairperson': 1,
                        'chairman': 1,
                        'vice chairperson': 2,
                        'vice chairman': 2,
                        'general secretary': 3,
                        'secretary': 3,
                        'chief accountant': 4,
                        'accountant': 4,
                        'auditor': 4,
                        'treasurer': 5,
                        'member': 6
                    };

                    const getPriority = (role: string) => {
                        const normalized = role?.toLowerCase().trim() || '';
                        for (const key in rolePriority) {
                            if (normalized.includes(key)) return rolePriority[key];
                        }
                        return 99; // Default for unknown roles
                    };

                    mappedMembers.sort((a: Member, b: Member) => {
                        return getPriority(a.role) - getPriority(b.role);
                    });

                    setMembers(mappedMembers);
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load board members');
            } finally {
                setLoading(false);
            }
        };

        fetchMembers();
    }, []);

    // Filter out Father Tadesse (ID 331) for the hero section
    const priest = members.find(m => m.id === 331) || {
        id: 331,
        name: "መልኣከ ፀሃይ Mel’Ake Tsehay keshi Tadesse",
        role: 'Parish Priest',
        email: '',
        phone: ''
    };

    // The rest of the board (excluding ID 331)
    const boardGrid = members.filter(m => m.id !== 331);

    const [showVolunteerModal, setShowVolunteerModal] = React.useState(false);
    const [volunteerMessage, setVolunteerMessage] = React.useState('');
    const [agreedToContact, setAgreedToContact] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [submitSuccess, setSubmitSuccess] = React.useState(false);
    const { firebaseUser } = useAuth();

    if (loading) {
        return <div className="min-h-screen flex justify-center items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div></div>;
    }

    const handleVolunteerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firebaseUser) {
            alert("Please log in to submit a request.");
            return;
        }

        setSubmitting(true);
        try {
            const token = await firebaseUser.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
            const response = await fetch(`${apiUrl}/api/volunteers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: volunteerMessage,
                    agreed_to_contact: agreedToContact
                })
            });

            if (response.ok) {
                setSubmitSuccess(true);
                setVolunteerMessage('');
                setAgreedToContact(false);
                setTimeout(() => {
                    setShowVolunteerModal(false);
                    setSubmitSuccess(false);
                }, 2000);
            } else {
                throw new Error('Failed to submit');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to submit request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 pb-16">
            {/* Header Section with subtle pattern */}
            <div className="bg-primary-800 text-white pt-24 pb-16 px-4 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-cross-lattice"></div>
                <div className="relative max-w-7xl mx-auto text-center">
                    <h1 className="text-3xl md:text-5xl font-serif font-bold mb-4">
                        {t('board.title') || 'Church Leadership'}
                    </h1>
                    <p className="text-primary-100 text-lg md:text-xl max-w-2xl mx-auto">
                        {t('board.subtitle') || 'Dedicated servants working together for the glory of God and the growth of our community.'}
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 -mt-10 relative z-10">

                {/* Featured Card: Church Father */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-12 border-t-4 border-amber-500 max-w-4xl mx-auto transform hover:-translate-y-1 transition-transform duration-300">
                    <div className="md:flex">
                        <div className="md:w-2/5 bg-neutral-100 relative min-h-[300px]">
                            <img
                                src={`${process.env.PUBLIC_URL || ''}/meleakeTsehay-Tadesse.png`}
                                alt="Keshi Tadesse"
                                className="absolute inset-0 w-full h-full object-cover object-top"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent md:hidden"></div>
                        </div>
                        <div className="md:w-3/5 p-8 md:p-12 flex flex-col justify-center text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-4 text-amber-600">
                                <i className="fas fa-cross text-2xl"></i>
                                <span className="uppercase tracking-widest font-semibold text-sm">Our Spiritual Father</span>
                                <i className="fas fa-cross text-2xl"></i>
                            </div>
                            <h2 className="text-3xl font-serif text-gray-900 mb-2">
                                {priest.name}
                            </h2>
                            <p className="text-xl text-primary-700 italic font-serif mb-6">
                                {t('priest.title') || 'Parish Priest / Head Admin'}
                            </p>
                            <p className="text-gray-600 leading-relaxed mb-6">
                                "{t('priest.bio') || "Leading our congregation with wisdom, humility, and unwavering faith. Serving the community through prayer, teachings, and spiritual guidance."}"
                            </p>
                            <div className="flex justify-center md:justify-start gap-4 items-center">
                                {priest.phone && (
                                    <a
                                        href={`tel:${priest.phone}`}
                                        className="w-10 h-10 flex items-center justify-center bg-primary-50 text-primary-700 rounded-full hover:bg-primary-100 transition-colors shadow-sm"
                                        title="Call"
                                    >
                                        <i className="fas fa-phone"></i>
                                    </a>
                                )}
                                <button className="px-6 py-2 border border-gray-300 text-gray-600 rounded-full text-sm font-semibold hover:bg-gray-50 transition-colors">
                                    <i className="fas fa-book-bible mr-2"></i> Teachings
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Board Members Grid */}
                <div className="mt-16">
                    <div className="flex items-center justify-center gap-4 mb-10">
                        <div className="h-px bg-gray-300 flex-1 max-w-[100px]"></div>
                        <h3 className="text-2xl font-serif text-gray-800 text-center">{t('board.currentMembers') || "Current Board Members"}</h3>
                        <div className="h-px bg-gray-300 flex-1 max-w-[100px]"></div>
                    </div>

                    {boardGrid.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">No board members found.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {boardGrid.map((member) => (
                                <div
                                    key={member.id}
                                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden group"
                                >
                                    <div className="p-6 flex flex-col items-center text-center">
                                        <div className="relative w-32 h-32 mb-4 shrink-0">
                                            <div className="absolute inset-0 bg-primary-100 rounded-full transform rotate-6 group-hover:rotate-12 transition-transform duration-300"></div>
                                            <img
                                                src={member.image}
                                                alt={member.name}
                                                className={`relative w-full h-full rounded-full border-4 border-white shadow-md group-hover:scale-105 transition-transform duration-300 bg-gray-50 object-cover ${member.firstName?.toLowerCase() === 'desta' ? 'object-[0%-20%]' : ['tafese', 'merafe', 'alemseged'].includes(member.firstName?.toLowerCase() || '') ? 'object-top' : ''
                                                    }`}
                                            />
                                        </div>

                                        <h3 className="mt-4 text-xl font-medium text-gray-900">
                                            {member.name}
                                        </h3>
                                        <p className="text-primary-600 font-medium">{member.role}</p>

                                        <div className="w-12 h-0.5 bg-gray-200 mb-4 group-hover:bg-primary-400 transition-colors"></div>

                                        <div className="flex gap-3 text-gray-400">
                                            {member.email && (
                                                <a href={`mailto:${member.email}`} className="hover:text-primary-600 transition-colors" title="Email">
                                                    <i className="fas fa-envelope"></i>
                                                </a>
                                            )}
                                            {member.phone && (
                                                <a href={`tel:${member.phone}`} className="hover:text-primary-600 transition-colors" title="Call">
                                                    <i className="fas fa-phone"></i>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Call to Action for Service */}
                <div className="mt-20 text-center bg-amber-50 rounded-2xl p-8 border border-amber-100">
                    <i className="fas fa-hands-helping text-4xl text-amber-500 mb-4"></i>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{t('board.volunteer.title') || "Called to Serve?"}</h3>
                    <p className="text-gray-600 max-w-2xl mx-auto mb-6">
                        {t('board.volunteer.desc') || "Our church relies on the dedication of our members. If you are interested in joining a committee or running for a board position next term, please reach out."}
                    </p>
                    <button
                        onClick={() => setShowVolunteerModal(true)}
                        className="px-8 py-3 bg-primary-700 text-white rounded-lg font-semibold hover:bg-primary-800 transition-transform transform hover:-translate-y-0.5 shadow-md"
                    >
                        {t('board.volunteer.action') || "Get Involved"}
                    </button>
                </div>

            </div>

            {/* Volunteer Modal */}
            {showVolunteerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 relative">
                        <button
                            onClick={() => setShowVolunteerModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <i className="fas fa-times"></i>
                        </button>

                        <h3 className="text-2xl font-bold text-gray-900 mb-4">Get Involved</h3>

                        {submitSuccess ? (
                            <div className="text-green-600 text-center py-8">
                                <i className="fas fa-check-circle text-4xl mb-3"></i>
                                <p>Thank you! Your request has been received. We will contact you soon.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleVolunteerSubmit}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        How would you like to help? (Max 255 chars)
                                    </label>
                                    <textarea
                                        value={volunteerMessage}
                                        onChange={(e) => setVolunteerMessage(e.target.value)}
                                        maxLength={255}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        rows={4}
                                        placeholder="I'm interested in joining the choir / I can help with accounting..."
                                    ></textarea>
                                    <p className="text-xs text-gray-500 mt-1 text-right">{volunteerMessage.length}/255</p>
                                </div>

                                <div className="mb-6 flex items-start">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="contact-consent"
                                            type="checkbox"
                                            checked={agreedToContact}
                                            onChange={(e) => setAgreedToContact(e.target.checked)}
                                            required
                                            className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                                        />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor="contact-consent" className="font-medium text-gray-700">
                                            I agree to receive a phone call from church leadership regarding this request.
                                        </label>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowVolunteerModal(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting || !firebaseUser}
                                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                                    >
                                        {submitting ? 'Submitting...' : 'Submit'}
                                    </button>
                                </div>
                                {!firebaseUser && (
                                    <p className="text-xs text-red-500 mt-2 text-center">You must be logged in to submit.</p>
                                )}
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};



export default BoardMembers;
